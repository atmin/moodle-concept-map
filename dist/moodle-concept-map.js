// Create a range object for efficently rendering strings to elements.
var range;

var doc = typeof document !== 'undefined' && document;

var testEl = doc ?
    doc.body || doc.createElement('div') :
    {};

var NS_XHTML = 'http://www.w3.org/1999/xhtml';

var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;

// Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
// (IE7+ support) <=IE7 does not support el.hasAttribute(name)
var hasAttributeNS;

if (testEl.hasAttributeNS) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttributeNS(namespaceURI, name);
    };
} else if (testEl.hasAttribute) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttribute(name);
    };
} else {
    hasAttributeNS = function(el, namespaceURI, name) {
        return !!el.getAttributeNode(name);
    };
}

function toElement(str) {
    if (!range && doc.createRange) {
        range = doc.createRange();
        range.selectNode(doc.body);
    }

    var fragment;
    if (range && range.createContextualFragment) {
        fragment = range.createContextualFragment(str);
    } else {
        fragment = doc.createElement('body');
        fragment.innerHTML = str;
    }
    return fragment.childNodes[0];
}

function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
        fromEl[name] = toEl[name];
        if (fromEl[name]) {
            fromEl.setAttribute(name, '');
        } else {
            fromEl.removeAttribute(name, '');
        }
    }
}

var specialElHandlers = {
    /**
     * Needed for IE. Apparently IE doesn't think that "selected" is an
     * attribute when reading over the attributes using selectEl.attributes
     */
    OPTION: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'selected');
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'checked');
        syncBooleanAttrProp(fromEl, toEl, 'disabled');

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value');
        }
    },

    TEXTAREA: function(fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        if (fromEl.firstChild) {
            fromEl.firstChild.nodeValue = newValue;
        }
    }
};

function noop() {}

/**
 * Returns true if two node's names are the same.
 *
 * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
 *       nodeName and different namespace URIs.
 *
 * @param {Element} a
 * @param {Element} b The target element
 * @return {boolean}
 */
function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;

    if (fromNodeName === toNodeName) {
        return true;
    }

    if (toEl.actualize &&
        fromNodeName.charCodeAt(0) < 91 && /* from tag name is upper case */
        toNodeName.charCodeAt(0) > 90 /* target tag name is lower case */) {
        // If the target element is a virtual DOM node then we may need to normalize the tag name
        // before comparing. Normal HTML elements that are in the "http://www.w3.org/1999/xhtml"
        // are converted to upper case
        return fromNodeName === toNodeName.toUpperCase();
    } else {
        return false;
    }
}

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ?
        doc.createElement(name) :
        doc.createElementNS(namespaceURI, name);
}

/**
 * Loop over all of the attributes on the target node and make sure the original
 * DOM node has the same attributes. If an attribute found on the original node
 * is not on the new node then remove it from the original node.
 *
 * @param  {Element} fromNode
 * @param  {Element} toNode
 */
function morphAttrs(fromNode, toNode) {
    var attrs = toNode.attributes;
    var i;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    if (toNode.assignAttributes) {
        toNode.assignAttributes(fromNode);
    } else {
        for (i = attrs.length - 1; i >= 0; --i) {
            attr = attrs[i];
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;
            attrValue = attr.value;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;
                fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
                }
            } else {
                fromValue = fromNode.getAttribute(attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttribute(attrName, attrValue);
                }
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    attrs = fromNode.attributes;

    for (i = attrs.length - 1; i >= 0; --i) {
        attr = attrs[i];
        if (attr.specified !== false) {
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;

                if (!hasAttributeNS(toNode, attrNamespaceURI, attrName)) {
                    fromNode.removeAttributeNS(attrNamespaceURI, attrName);
                }
            } else {
                if (!hasAttributeNS(toNode, null, attrName)) {
                    fromNode.removeAttribute(attrName);
                }
            }
        }
    }
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function defaultGetNodeKey(node) {
    return node.id;
}

function morphdom(fromNode, toNode, options) {
    if (!options) {
        options = {};
    }

    if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
            var toNodeHtml = toNode;
            toNode = doc.createElement('html');
            toNode.innerHTML = toNodeHtml;
        } else {
            toNode = toElement(toNode);
        }
    }

    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
    var childrenOnly = options.childrenOnly === true;

    // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
    var fromNodesLookup = {};
    var keyedRemovalList;

    function addKeyedRemoval(key) {
        if (keyedRemovalList) {
            keyedRemovalList.push(key);
        } else {
            keyedRemovalList = [key];
        }
    }

    function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {

                var key = undefined;

                if (skipKeyedNodes && (key = getNodeKey(curChild))) {
                    // If we are skipping keyed nodes then we add the key
                    // to a list so that it can be handled at the very end.
                    addKeyedRemoval(key);
                } else {
                    // Only report the node as discarded if it is not keyed. We do this because
                    // at the end we loop through all keyed elements that were unmatched
                    // and then discard them in one final pass.
                    onNodeDiscarded(curChild);
                    if (curChild.firstChild) {
                        walkDiscardedChildNodes(curChild, skipKeyedNodes);
                    }
                }

                curChild = curChild.nextSibling;
            }
        }
    }

    /**
     * Removes a DOM node out of the original DOM
     *
     * @param  {Node} node The node to remove
     * @param  {Node} parentNode The nodes parent
     * @param  {Boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
     * @return {undefined}
     */
    function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
            return;
        }

        if (parentNode) {
            parentNode.removeChild(node);
        }

        onNodeDiscarded(node);
        walkDiscardedChildNodes(node, skipKeyedNodes);
    }

    // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
    // function indexTree(root) {
    //     var treeWalker = document.createTreeWalker(
    //         root,
    //         NodeFilter.SHOW_ELEMENT);
    //
    //     var el;
    //     while((el = treeWalker.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
    //
    // function indexTree(node) {
    //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
    //     var el;
    //     while((el = nodeIterator.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {
                var key = getNodeKey(curChild);
                if (key) {
                    fromNodesLookup[key] = curChild;
                }

                // Walk recursively
                indexTree(curChild);

                curChild = curChild.nextSibling;
            }
        }
    }

    indexTree(fromNode);

    function handleNodeAdded(el) {
        onNodeAdded(el);

        var curChild = el.firstChild;
        while (curChild) {
            var nextSibling = curChild.nextSibling;

            var key = getNodeKey(curChild);
            if (key) {
                var unmatchedFromEl = fromNodesLookup[key];
                if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
                    curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
                    morphEl(unmatchedFromEl, curChild);
                }
            }

            handleNodeAdded(curChild);
            curChild = nextSibling;
        }
    }

    function morphEl(fromEl, toEl, childrenOnly) {
        var toElKey = getNodeKey(toEl);
        var curFromNodeKey;

        if (toElKey) {
            // If an element with an ID is being morphed then it is will be in the final
            // DOM so clear it out of the saved elements collection
            delete fromNodesLookup[toElKey];
        }

        if (toNode.isSameNode && toNode.isSameNode(fromNode)) {
            return;
        }

        if (!childrenOnly) {
            if (onBeforeElUpdated(fromEl, toEl) === false) {
                return;
            }

            morphAttrs(fromEl, toEl);
            onElUpdated(fromEl);

            if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return;
            }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
            var curToNodeChild = toEl.firstChild;
            var curFromNodeChild = fromEl.firstChild;
            var curToNodeKey;

            var fromNextSibling;
            var toNextSibling;
            var matchingFromEl;

            outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling;
                curToNodeKey = getNodeKey(curToNodeChild);

                while (curFromNodeChild) {
                    fromNextSibling = curFromNodeChild.nextSibling;

                    if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    curFromNodeKey = getNodeKey(curFromNodeChild);

                    var curFromNodeType = curFromNodeChild.nodeType;

                    var isCompatible = undefined;

                    if (curFromNodeType === curToNodeChild.nodeType) {
                        if (curFromNodeType === ELEMENT_NODE) {
                            // Both nodes being compared are Element nodes

                            if (curToNodeKey) {
                                // The target node has a key so we want to match it up with the correct element
                                // in the original DOM tree
                                if (curToNodeKey !== curFromNodeKey) {
                                    // The current element in the original DOM tree does not have a matching key so
                                    // let's check our lookup to see if there is a matching element in the original
                                    // DOM tree
                                    if ((matchingFromEl = fromNodesLookup[curToNodeKey])) {
                                        if (curFromNodeChild.nextSibling === matchingFromEl) {
                                            // Special case for single element removals. To avoid removing the original
                                            // DOM node out of the tree (since that can break CSS transitions, etc.),
                                            // we will instead discard the current node and wait until the next
                                            // iteration to properly match up the keyed target element with its matching
                                            // element in the original tree
                                            isCompatible = false;
                                        } else {
                                            // We found a matching keyed element somewhere in the original DOM tree.
                                            // Let's moving the original DOM node into the current position and morph
                                            // it.

                                            // NOTE: We use insertBefore instead of replaceChild because we want to go through
                                            // the `removeNode()` function for the node that is being discarded so that
                                            // all lifecycle hooks are correctly invoked
                                            fromEl.insertBefore(matchingFromEl, curFromNodeChild);

                                            if (curFromNodeKey) {
                                                // Since the node is keyed it might be matched up later so we defer
                                                // the actual removal to later
                                                addKeyedRemoval(curFromNodeKey);
                                            } else {
                                                // NOTE: we skip nested keyed nodes from being removed since there is
                                                //       still a chance they will be matched up later
                                                removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);

                                            }
                                            fromNextSibling = curFromNodeChild.nextSibling;
                                            curFromNodeChild = matchingFromEl;
                                        }
                                    } else {
                                        // The nodes are not compatible since the "to" node has a key and there
                                        // is no matching keyed node in the source tree
                                        isCompatible = false;
                                    }
                                }
                            } else if (curFromNodeKey) {
                                // The original has a key
                                isCompatible = false;
                            }

                            isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
                            if (isCompatible) {
                                // We found compatible DOM elements so transform
                                // the current "from" node to match the current
                                // target DOM node.
                                morphEl(curFromNodeChild, curToNodeChild);
                            }

                        } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                            // Both nodes being compared are Text or Comment nodes
                            isCompatible = true;
                            // Simply update nodeValue on the original node to
                            // change the text value
                            curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                        }
                    }

                    if (isCompatible) {
                        // Advance both the "to" child and the "from" child since we found a match
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    // No compatible match so remove the old node from the DOM and continue trying to find a
                    // match in the original DOM. However, we only do this if the from node is not keyed
                    // since it is possible that a keyed node might match up with a node somewhere else in the
                    // target tree and we don't want to discard it just yet since it still might find a
                    // home in the final DOM tree. After everything is done we will remove any keyed nodes
                    // that didn't find a home
                    if (curFromNodeKey) {
                        // Since the node is keyed it might be matched up later so we defer
                        // the actual removal to later
                        addKeyedRemoval(curFromNodeKey);
                    } else {
                        // NOTE: we skip nested keyed nodes from being removed since there is
                        //       still a chance they will be matched up later
                        removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                    }

                    curFromNodeChild = fromNextSibling;
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to" node
                // to the end
                if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
                    fromEl.appendChild(matchingFromEl);
                    morphEl(matchingFromEl, curToNodeChild);
                } else {
                    var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
                    if (onBeforeNodeAddedResult !== false) {
                        if (onBeforeNodeAddedResult) {
                            curToNodeChild = onBeforeNodeAddedResult;
                        }

                        if (curToNodeChild.actualize) {
                            curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
                        }
                        fromEl.appendChild(curToNodeChild);
                        handleNodeAdded(curToNodeChild);
                    }
                }

                curToNodeChild = toNextSibling;
                curFromNodeChild = fromNextSibling;
            }

            // We have processed all of the "to nodes". If curFromNodeChild is
            // non-null then we still have some from nodes left over that need
            // to be removed
            while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling;
                if ((curFromNodeKey = getNodeKey(curFromNodeChild))) {
                    // Since the node is keyed it might be matched up later so we defer
                    // the actual removal to later
                    addKeyedRemoval(curFromNodeKey);
                } else {
                    // NOTE: we skip nested keyed nodes from being removed since there is
                    //       still a chance they will be matched up later
                    removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                }
                curFromNodeChild = fromNextSibling;
            }
        }

        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
            specialElHandler(fromEl, toEl);
        }
    } // END: morphEl(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
            if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                    onNodeDiscarded(fromNode);
                    morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
                }
            } else {
                // Going from an element node to a text node
                morphedNode = toNode;
            }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // Text or comment node
            if (toNodeType === morphedNodeType) {
                morphedNode.nodeValue = toNode.nodeValue;
                return morphedNode;
            } else {
                // Text node to something else
                morphedNode = toNode;
            }
        }
    }

    if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode);
    } else {
        morphEl(morphedNode, toNode, childrenOnly);

        // We now need to loop over any keyed nodes that might need to be
        // removed. We only do the removal if we know that the keyed node
        // never found a match. When a keyed node is matched up we remove
        // it out of fromNodesLookup and we use fromNodesLookup to determine
        // if a keyed node has been matched up or not
        if (keyedRemovalList) {
            for (var i=0, len=keyedRemovalList.length; i<len; i++) {
                var elToRemove = fromNodesLookup[keyedRemovalList[i]];
                if (elToRemove) {
                    removeNode(elToRemove, elToRemove.parentNode, false);
                }
            }
        }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode.actualize) {
            morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
        }
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
}

var index = morphdom;

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var matchesSelector = createCommonjsModule(function (module) {
/*! Lee Cooper <lee.cooper@lski.uk> - matches-selector-polyfill - 1.0.0 */!function(e,t){if(!e.Element){ throw new Error("Element is required for matches-selector-polyfill to be used"); }"function"==typeof define&&define.amd?define([],t):"object"==typeof module&&module.exports&&(module.exports=t())}(commonjsGlobal,function(){"use strict";function e(e){for(var t=this,r=t.parentNode.querySelectorAll(e),o=r.length;--o>=0;){ if(r.item(o)===t){ return!0; } }return!1}function t(e,t){return o.call(e,t)}var r=Element.prototype,o=r.matches||r.webkitMatchesSelector||r.mozMatchesSelector||r.msMatchesSelector||e;return t});
});

var selectors = {};

// Observe document for dynamically added components
(new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    [].slice.call(mutation.addedNodes || [])
      .filter(function (node) { return node.nodeType === 1; })
      .forEach(function (node) {
        Object.keys(selectors)
          .filter(function (selector) { return node.matches(selector); })
          .forEach(function (selector) { return selectors[selector](node); });
      });
  });
})).observe(document, {
  childList: true,
  subtree: true
});

// DOM builder, JSX style
var svgns = 'http://www.w3.org/2000/svg';
var specialAttrs = {
  className: 'class',
  htmlFor: 'for',
};
var svgTags = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern',
];
var kebabCase = function (str) { return str.replace(/[A-Z]/g, function (letter, pos) { return '-' + letter.toLowerCase(); }); };
var h = function (nodeName, attributes) {
  var children = [], len = arguments.length - 2;
  while ( len-- > 0 ) children[ len ] = arguments[ len + 2 ];

  var node = (svgTags.indexOf(nodeName) > -1) ?
    document.createElementNS(svgns, nodeName) :
    document.createElement(nodeName);
  var setAttribute = function (attr) {
    var val = attributes[attr];
    var value = val && typeof val === 'object' ?
      Object.keys(attributes[attr])
        .map(function (key) { return ((kebabCase(key)) + ":" + (attributes[attr][key])); })
        .join(';') : val;
    if (value === null) {
      node.removeAttribute(specialAttrs[attr] || attr);
    } else {
      node.setAttribute(specialAttrs[attr] || attr, value);
    }
  };
  Object.keys(attributes || {}).forEach(setAttribute);
  children.forEach(function (child) {
    if (Array.isArray(child)) {
      var fragment = document.createDocumentFragment();
      child.forEach(function (subchild) { return fragment.appendChild(subchild); });
      node.appendChild(fragment);
    } else if (typeof (child || '') === 'string') {
      node.appendChild(document.createTextNode(child || ''));
    } else {
      node.appendChild(child);
    }
  });
  return node;
};

// proxy h as React.createElement
var React = {createElement: function () {
  var args = [], len = arguments.length;
  while ( len-- ) args[ len ] = arguments[ len ];

  return h.apply(void 0, args);
}};

// bind a selector to a view function
var bind = function (selector, view, options) {
  if ( options === void 0 ) options={};

  var render = function (node) {
    index(node, view(node.dataset), Object.assign({}, options, {childrenOnly: true}))
  };
  var init = function (node) {
    (new MutationObserver(function (mutations) {
      var dirty = mutations.some(function (mut) { return mut.attributeName ?
        mut.attributeName.startsWith('data-') : Boolean(mut.removedNodes.length); }
      );
      if (dirty) {
        render(node);
      }
    })).observe(node, {
      attributes: true,
      childList: true,
    });
    if (typeof view.init === 'function') {
      view.init(node);
    }
    render(node);
  };
  [].slice.call(document.querySelectorAll(selector)).forEach(init);
  selectors[selector] = selectors[selector] || init;
};

var DragDropTouch;
(function (DragDropTouch_1) {
    'use strict';
    /**
     * Object used to hold the data that is being dragged during drag and drop operations.
     *
     * It may hold one or more data items of different types. For more information about
     * drag and drop operations and data transfer objects, see
     * <a href="https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer">HTML Drag and Drop API</a>.
     *
     * This object is created automatically by the @see:DragDropTouch singleton and is
     * accessible through the @see:dataTransfer property of all drag events.
     */
    var DataTransfer = (function () {
        function DataTransfer() {
            this._dropEffect = 'move';
            this._effectAllowed = 'all';
            this._data = {};
        }
        Object.defineProperty(DataTransfer.prototype, "dropEffect", {
            /**
             * Gets or sets the type of drag-and-drop operation currently selected.
             * The value must be 'none',  'copy',  'link', or 'move'.
             */
            get: function () {
                return this._dropEffect;
            },
            set: function (value) {
                this._dropEffect = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            /**
             * Gets or sets the types of operations that are possible.
             * Must be one of 'none', 'copy', 'copyLink', 'copyMove', 'link',
             * 'linkMove', 'move', 'all' or 'uninitialized'.
             */
            get: function () {
                return this._effectAllowed;
            },
            set: function (value) {
                this._effectAllowed = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "types", {
            /**
             * Gets an array of strings giving the formats that were set in the @see:dragstart event.
             */
            get: function () {
                return Object.keys(this._data);
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Removes the data associated with a given type.
         *
         * The type argument is optional. If the type is empty or not specified, the data
         * associated with all types is removed. If data for the specified type does not exist,
         * or the data transfer contains no data, this method will have no effect.
         *
         * @param type Type of data to remove.
         */
        DataTransfer.prototype.clearData = function (type) {
            if (type != null) {
                delete this._data[type];
            }
            else {
                this._data = null;
            }
        };
        /**
         * Retrieves the data for a given type, or an empty string if data for that type does
         * not exist or the data transfer contains no data.
         *
         * @param type Type of data to retrieve.
         */
        DataTransfer.prototype.getData = function (type) {
            return this._data[type] || '';
        };
        /**
         * Set the data for a given type.
         *
         * For a list of recommended drag types, please see
         * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Recommended_Drag_Types.
         *
         * @param type Type of data to add.
         * @param value Data to add.
         */
        DataTransfer.prototype.setData = function (type, value) {
            this._data[type] = value;
        };
        /**
         * Set the image to be used for dragging if a custom one is desired.
         *
         * @param img An image element to use as the drag feedback image.
         * @param offsetX The horizontal offset within the image.
         * @param offsetY The vertical offset within the image.
         */
        DataTransfer.prototype.setDragImage = function (img, offsetX, offsetY) {
            var ddt = DragDropTouch._instance;
            ddt._imgCustom = img;
            ddt._imgOffset = { x: offsetX, y: offsetY };
        };
        return DataTransfer;
    }());
    DragDropTouch_1.DataTransfer = DataTransfer;
    /**
     * Defines a class that adds support for touch-based HTML5 drag/drop operations.
     *
     * The @see:DragDropTouch class listens to touch events and raises the
     * appropriate HTML5 drag/drop events as if the events had been caused
     * by mouse actions.
     *
     * The purpose of this class is to enable using existing, standard HTML5
     * drag/drop code on mobile devices running IOS or Android.
     *
     * To use, include the DragDropTouch.js file on the page. The class will
     * automatically start monitoring touch events and will raise the HTML5
     * drag drop events (dragstart, dragenter, dragleave, drop, dragend) which
     * should be handled by the application.
     *
     * For details and examples on HTML drag and drop, see
     * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Drag_operations.
     */
    var DragDropTouch = (function () {
        /**
         * Initializes the single instance of the @see:DragDropTouch class.
         */
        function DragDropTouch() {
            this._lastClick = 0;
            // enforce singleton pattern
            if (DragDropTouch._instance) {
                throw 'DragDropTouch instance already created.';
            }
            // listen to touch events
            if ('ontouchstart' in document) {
                var d = document, ts = this._touchstart.bind(this), tm = this._touchmove.bind(this), te = this._touchend.bind(this);
                d.addEventListener('touchstart', ts);
                d.addEventListener('touchmove', tm);
                d.addEventListener('touchend', te);
                d.addEventListener('touchcancel', te);
            }
        }
        /**
         * Gets a reference to the @see:DragDropTouch singleton.
         */
        DragDropTouch.getInstance = function () {
            return DragDropTouch._instance;
        };
        // ** event handlers
        DragDropTouch.prototype._touchstart = function (e) {
            var _this = this;
            if (this._shouldHandle(e)) {
                // raise double-click and prevent zooming
                if (Date.now() - this._lastClick < DragDropTouch._DBLCLICK) {
                    if (this._dispatchEvent(e, 'dblclick', e.target)) {
                        e.preventDefault();
                        this._reset();
                        return;
                    }
                }
                // clear all variables
                this._reset();
                // get nearest draggable element
                var src = this._closestDraggable(e.target);
                if (src) {
                    // give caller a chance to handle the hover/move events
                    if (!this._dispatchEvent(e, 'mousemove', e.target) &&
                        !this._dispatchEvent(e, 'mousedown', e.target)) {
                        // get ready to start dragging
                        this._dragSource = src;
                        this._ptDown = this._getPoint(e);
                        this._lastTouch = e;
                        e.preventDefault();
                        // show context menu if the user hasn't started dragging after a while
                        setTimeout(function () {
                            if (_this._dragSource == src && _this._img == null) {
                                if (_this._dispatchEvent(e, 'contextmenu', src)) {
                                    _this._reset();
                                }
                            }
                        }, DragDropTouch._CTXMENU);
                    }
                }
            }
        };
        DragDropTouch.prototype._touchmove = function (e) {
            if (this._shouldHandle(e)) {
                // see if target wants to handle move
                var target = this._getTarget(e);
                if (this._dispatchEvent(e, 'mousemove', target)) {
                    this._lastTouch = e;
                    e.preventDefault();
                    return;
                }
                // start dragging
                if (this._dragSource && !this._img) {
                    var delta = this._getDelta(e);
                    if (delta > DragDropTouch._THRESHOLD) {
                        this._dispatchEvent(e, 'dragstart', this._dragSource);
                        this._createImage(e);
                        this._dispatchEvent(e, 'dragenter', target);
                    }
                }
                // continue dragging
                if (this._img) {
                    this._lastTouch = e;
                    e.preventDefault(); // prevent scrolling
                    if (target != this._lastTarget) {
                        this._dispatchEvent(this._lastTouch, 'dragleave', this._lastTarget);
                        this._dispatchEvent(e, 'dragenter', target);
                        this._lastTarget = target;
                    }
                    this._moveImage(e);
                    this._dispatchEvent(e, 'dragover', target);
                }
            }
        };
        DragDropTouch.prototype._touchend = function (e) {
            if (this._shouldHandle(e)) {
                // see if target wants to handle up
                if (this._dispatchEvent(this._lastTouch, 'mouseup', e.target)) {
                    e.preventDefault();
                    return;
                }
                // user clicked the element but didn't drag, so clear the source and simulate a click
                if (!this._img) {
                    this._dragSource = null;
                    this._dispatchEvent(this._lastTouch, 'click', e.target);
                    this._lastClick = Date.now();
                }
                // finish dragging
                this._destroyImage();
                if (this._dragSource) {
                    if (e.type.indexOf('cancel') < 0) {
                        this._dispatchEvent(this._lastTouch, 'drop', this._lastTarget);
                    }
                    this._dispatchEvent(this._lastTouch, 'dragend', this._dragSource);
                    this._reset();
                }
            }
        };
        // ** utilities
        // ignore events that have been handled or that involve more than one touch
        DragDropTouch.prototype._shouldHandle = function (e) {
            return e &&
                !e.defaultPrevented &&
                e.touches && e.touches.length < 2;
        };
        // clear all members
        DragDropTouch.prototype._reset = function () {
            this._destroyImage();
            this._dragSource = null;
            this._lastTouch = null;
            this._lastTarget = null;
            this._ptDown = null;
            this._dataTransfer = new DataTransfer();
        };
        // get point for a touch event
        DragDropTouch.prototype._getPoint = function (e, page) {
            if (e && e.touches) {
                e = e.touches[0];
            }
            return { x: page ? e.pageX : e.clientX, y: page ? e.pageY : e.clientY };
        };
        // get distance between the current touch event and the first one
        DragDropTouch.prototype._getDelta = function (e) {
            var p = this._getPoint(e);
            return Math.abs(p.x - this._ptDown.x) + Math.abs(p.y - this._ptDown.y);
        };
        // get the element at a given touch event
        DragDropTouch.prototype._getTarget = function (e) {
            var pt = this._getPoint(e), el = document.elementFromPoint(pt.x, pt.y);
            while (el && getComputedStyle(el).pointerEvents == 'none') {
                el = el.parentElement;
            }
            return el;
        };
        // create drag image from source element
        DragDropTouch.prototype._createImage = function (e) {
            // just in case...
            if (this._img) {
                this._destroyImage();
            }
            // create drag image from custom element or drag source
            var src = this._imgCustom || this._dragSource;
            this._img = src.cloneNode(true);
            this._copyStyle(src, this._img);
            this._img.style.top = this._img.style.left = '-9999px';
            // if creating from drag source, apply offset and opacity
            if (!this._imgCustom) {
                var rc = src.getBoundingClientRect(), pt = this._getPoint(e);
                this._imgOffset = { x: pt.x - rc.left, y: pt.y - rc.top };
                this._img.style.opacity = DragDropTouch._OPACITY.toString();
            }
            // add image to document
            this._moveImage(e);
            document.body.appendChild(this._img);
        };
        // dispose of drag image element
        DragDropTouch.prototype._destroyImage = function () {
            if (this._img && this._img.parentElement) {
                this._img.parentElement.removeChild(this._img);
            }
            this._img = null;
            this._imgCustom = null;
        };
        // move the drag image element
        DragDropTouch.prototype._moveImage = function (e) {
            var _this = this;
            if (this._img) {
                requestAnimationFrame(function () {
                    var pt = _this._getPoint(e, true), s = _this._img.style;
                    s.position = 'absolute';
                    s.pointerEvents = 'none';
                    s.zIndex = '999999';
                    s.left = Math.round(pt.x - _this._imgOffset.x) + 'px';
                    s.top = Math.round(pt.y - _this._imgOffset.y) + 'px';
                });
            }
        };
        // copy properties from an object to another
        DragDropTouch.prototype._copyProps = function (dst, src, props) {
            for (var i = 0; i < props.length; i++) {
                var p = props[i];
                dst[p] = src[p];
            }
        };
        DragDropTouch.prototype._copyStyle = function (src, dst) {
            var this$1 = this;

            // remove potentially troublesome attributes
            DragDropTouch._rmvAtts.forEach(function (att) {
                dst.removeAttribute(att);
            });
            // copy canvas content
            if (src instanceof HTMLCanvasElement) {
                var cSrc = src, cDst = dst;
                cDst.width = cSrc.width;
                cDst.height = cSrc.height;
                cDst.getContext('2d').drawImage(cSrc, 0, 0);
            }
            // copy style
            var cs = getComputedStyle(src);
            for (var i = 0; i < cs.length; i++) {
                var key = cs[i];
                dst.style[key] = cs[key];
            }
            dst.style.pointerEvents = 'none';
            // and repeat for all children
            for (var i = 0; i < src.children.length; i++) {
                this$1._copyStyle(src.children[i], dst.children[i]);
            }
        };
        DragDropTouch.prototype._dispatchEvent = function (e, type, target) {
            if (e && target) {
                var evt = document.createEvent('Event'), t = e.touches ? e.touches[0] : e;
                evt.initEvent(type, true, true);
                evt.button = 0;
                evt.which = evt.buttons = 1;
                this._copyProps(evt, e, DragDropTouch._kbdProps);
                this._copyProps(evt, t, DragDropTouch._ptProps);
                evt.dataTransfer = this._dataTransfer;
                target.dispatchEvent(evt);
                return evt.defaultPrevented;
            }
            return false;
        };
        // gets an element's closest draggable ancestor
        DragDropTouch.prototype._closestDraggable = function (e) {
            for (; e; e = e.parentElement) {
                if (e.hasAttribute('draggable') && e.draggable) {
                    return e;
                }
            }
            return null;
        };
        /*private*/ DragDropTouch._instance = new DragDropTouch(); // singleton
        // constants
        DragDropTouch._THRESHOLD = 5; // pixels to move before drag starts
        DragDropTouch._OPACITY = 0.5; // drag image opacity
        DragDropTouch._DBLCLICK = 500; // max ms between clicks in a double click
        DragDropTouch._CTXMENU = 900; // ms to hold before raising 'contextmenu' event
        // copy styles/attributes from drag source to drag image element
        DragDropTouch._rmvAtts = 'id,class,style,draggable'.split(',');
        // synthesize and dispatch an event
        // returns true if the event has been handled (e.preventDefault == true)
        DragDropTouch._kbdProps = 'altKey,ctrlKey,metaKey,shiftKey'.split(',');
        DragDropTouch._ptProps = 'pageX,pageY,clientX,clientY,screenX,screenY'.split(',');
        return DragDropTouch;
    }());
    DragDropTouch_1.DragDropTouch = DragDropTouch;
})(DragDropTouch || (DragDropTouch = {}));

var theme = {
  edgeBorder: '1px solid #666',
  edgeBorderDragging: '1px dashed #666',
  edgeConnectorBackground: 'blue',
  edgeLabelBackground: 'rgba(255, 255, 255, 0.8)',
  vertexBackground: 'white',
  vertexBorder: '1px solid #999',
  selectedVertexBorder: '2px solid blue',
  vertexBorderRadius: '5px',
};

var symbolStyle = {
  backgroundColor: '#fff',
  border: '1px solid #999',
  borderRadius: '50%',
  color: '#333',
  cursor: 'pointer',
  display: 'inline-block',
  width: '1em',
  lineHeight: '1em',
  fontSize: '130%',
  marginLeft: '0.25em',
  padding: '2px',
  textAlign: 'center',
};

var modalOverlay = (
  h( 'div', {
    className: 'ModalOverlay', style: {
      backgroundColor: '#fff',
      opacity: 0.8,
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
    } })
);

var lineTransform = function (x1, y1, x2, y2, units) {
  var deltaX = x2 - x1;
  var deltaY = y2 - y1;
  var length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  var angle = Math.acos(deltaX / length);
  if (deltaY < 0) {
    angle = -angle;
  }
  return {
    transform: ("rotate(" + angle + "rad)"),
    width: ("" + length + units),
  };
};

var vertex = function (data) {
  var dragged = data.dragged;
  var dropVertexId = data.dropVertexId;
  var editing = data.editing;
  var id = data.id;
  var label = data.label;
  var left = data.left;
  var selected = data.selected;
  var top = data.top;
  var vertexConnectorFrom = data.vertexConnectorFrom;

  var border = theme.vertexBorder;
  if (selected || dropVertexId == id) {
    border = theme.selectedVertexBorder;
  }
  if (dragged) {
    border = theme.edgeBorderDragging;
  }

  return (
    h( 'div', null,
      editing ? modalOverlay : null,

      h( 'div', {
        className: 'Vertex', 'data-id': id, draggable: 'true', style: {
          background: dropVertexId == id ? '#EEEEFF' : theme.vertexBackground,
          border: border,
          borderRadius: theme.vertexBorderRadius,
          color: selected ? 'blue' : 'inherit',
          minHeight: '1em',
          position: 'absolute',
          left: (left + "px"),
          top: (top + "px"),
          padding: editing ? '0.25em' : '0.5em 1em',
          transform: 'translate(-50%, -50%)',
          zIndex: editing ? 101 : 1,
        } },

        editing ? (
          h( 'div', null,
            h( 'input', {
              className: 'EditVertexLabelInput', 'data-id': id, style: {
                border: '1px solid #999',
                borderRadius: '1em',
                fontSize: '100%',
                padding: '0.25em 1em',
                width: '5em',
              }, placeholder: 'Vertex label', value: label }),
            h( 'a', {
              className: 'EditVertexLabelOk', 'data-id': id, style: Object.assign({}, symbolStyle,
                {color: 'green'}), title: 'OK' }, "✓"),
            h( 'a', {
              className: 'EditVertexLabelCancel', 'data-id': id, style: Object.assign({}, symbolStyle,
                {color: 'red'}), title: 'Cancel' }, "×")
          )
        ) : label,

        selected ? (
          h( 'a', {
            className: 'VertexConnector', draggable: 'true', style: {
              color: 'white',
              display: (vertexConnectorFrom == id || dragged) ? 'none' : 'block',
              background: theme.edgeConnectorBackground,
              border: '2px solid white',
              borderRadius: '50%',
              position: 'absolute',
              left: 'calc(50% - 0.75em)',
              top: 'calc(100% - 0.5em)',
              width: '1.5em',
              height: '1.5em',
              textAlign: 'center',
            }, title: 'Drag connector to another vertex to create edge' }, "☍")
        ) : null,
        selected ? (
          h( 'div', {
            className: 'ActionButtonBar', style: {
              display: (vertexConnectorFrom == id || dragged) ? 'none' : 'block',
              position: 'absolute',
              width: '10em',
              left: 'calc(100% + 0.5em)',
              top: '50%',
              transform: 'translateY(-50%)',
            } },
            h( 'a', {
              className: 'EditVertexLabelAction', 'data-id': id, style: Object.assign({}, symbolStyle), title: 'Edit vertex label' }, "✎"),
            h( 'a', {
              className: 'DeleteVertexAction', 'data-id': id, style: Object.assign({}, symbolStyle,
                {color: 'red'}), title: 'Delete vertex' }, "␡")
          )
        ) : null
      )
    )
  );
};

var edge = function (data) {
  var editing = data.editing;
  var from = data.from;
  var index = data.index;
  var label = data.label;
  var selected = data.selected;
  var to = data.to;

  var units = 'px';
  var edgeThickness = '10';
  var width = to.left - from.left;
  var height = to.top - from.top;
  var labelLeft = from.left + width / 2;
  var labelTop = from.top + height / 2;

  return (
    h( 'div', null,
      editing ? modalOverlay : null,
      h( 'div', {
        className: ("Edge" + (selected ? ' --selected' : '')), 'data-index': index, style: Object.assign({}, {left: ("" + (from.left) + units),
          top: ("" + (from.top) + units),
          height: ("" + edgeThickness + units)},
          lineTransform(from.left, from.top, to.left, to.top, units)) }),
      h( 'div', {
        style: {
          background: label ? theme.edgeLabelBackground : 'transparent',
          position: 'absolute',
          left: ("" + labelLeft + units),
          top: ("" + labelTop + units),
          transform: 'translate(-50%, -50%)',
          zIndex: editing ? 101 : 'default',
        } },
        editing ? (
          h( 'div', null,
            h( 'input', {
              className: 'EditEdgeLabelInput', 'data-index': index, style: {
                border: '1px solid #999',
                borderRadius: '1em',
                fontSize: '100%',
                padding: '0.25em 1em',
                width: '5em',
              }, placeholder: 'Edge label', value: label }),
            h( 'a', {
              className: 'EditEdgeLabelOk', 'data-index': index, style: Object.assign({}, symbolStyle,
                {color: 'green'}), title: 'OK' }, "✓"),
            h( 'a', {
              className: 'EditEdgeLabelCancel', 'data-index': index, style: Object.assign({}, symbolStyle,
                {color: 'red'}), title: 'Cancel' }, "×")
          )
        ) : (
          h( 'span', {
            className: 'EdgeLabel', 'data-index': index, style: {
              color: selected ? 'blue' : 'inherit',
              cursor: 'pointer',
              marginRight: '0.5em',
            } }, label)
        ),

        selected ? (
          h( 'div', {
            className: 'ActionButtonBar', style: {
              position: 'absolute',
              width: '10em',
              left: '100%',
              top: '-20%',
            } },
            h( 'a', {
              className: 'EditEdgeLabelAction', 'data-index': index, style: Object.assign({}, symbolStyle), title: 'Edit edge label' }, "✎"),
            h( 'a', {
              className: 'DeleteEdgeAction', 'data-index': index, style: Object.assign({}, symbolStyle,
                {color: 'red'}), title: 'Delete edge' }, "␡")
          )
        ) : null
      )
    )
  );
};

var addNewVertex = function (style) { return (
  h( 'div', {
    style: Object.assign({}, {position: 'fixed',
      right: 0,
      top: 0},
      style) },
    h( 'a', {
      className: 'NewVertexAction', draggable: 'true', style: {
        backgroundColor: 'blue',
        borderRadius: '50%',
        color: 'white',
        cursor: 'move',
        fontSize: '42px',
        display: 'block',
        margin: '16px 16px 16px',
        width: '64px',
        lineHeight: '64px',
        textAlign: 'center',
      } }, "+"),
    h( 'div', {
      style: {
        color: '#666',
        fontSize: '12px',
        lineHeight: 1,
      textAlign: 'center',
      } }, "Drag to add", h( 'br', null ), " new vertex")
  )
); };

var conceptMap = function (data) {
  var ref = JSON.parse(data.config);
  var edges = ref.edges;
  var vertices = ref.vertices;

  var verticesById = vertices.reduce(function (result, item) {
    result[item.id] = item;
    return result;
  }, {});

  return (
    h( 'body', null,
      h( 'div', { style: {position: 'relative'} },
        edges.map(function (item, index) { return edge(Object.assign({}, item,
          {editing: index == data.editedEdgeIndex,
          from: verticesById[item.from],
          index: index,
          selected: index == data.selectedEdgeIndex,
          to: verticesById[item.to]})); }),

        vertices.map(function (item) { return vertex(Object.assign({}, item,
          {dragged: item.id == data.draggedVertexId,
          dropVertexId: data.dropVertexId,
          editing: item.id == data.editedVertexId,
          vertexConnectorFrom: data.vertexConnectorFrom,
          selected: item.id == data.selectedVertexId})); }),

        addNewVertex({
          display: data.selectedVertexId || data.selectedEdgeIndex ?
            'none' : 'block'
        })
      )
    )
  );
};

// All events are handled here
conceptMap.init = function (node) {

  // Utility functions
  var handleDelegatedEvent = function (event, selectorHandlers) {
    var target = event.target;
    var handlerKey = Object.keys(selectorHandlers)
      .filter(function (selector) { return target.matches(selector); })
      .shift();
    (selectorHandlers[handlerKey] || Function.prototype)(target);
  };
  var getConfig = function () { return JSON.parse(node.dataset.config); };
  var setConfig = function (config) { return node.dataset.config = JSON.stringify(config); };;
  var getVertexById = function (config, id) { return (
    config.vertices
      .filter(function (vertex) { return vertex.id == id; })
      .shift()
  ); };
  var edgeExists = function (config, v1, v2) { return (
    config.edges
      .filter(function (edge) { return (edge.from == v1 && edge.to == v2) ||
        (edge.from == v2 && edge.to == v1); }
      )
      .length > 0
  ); };

  // Event handlers
  var handleEditVertexLabelOk = function (target) {
    var config = getConfig();
    var state = node.dataset;
    getVertexById(config, target.dataset.id).label =
      document.querySelector('.EditVertexLabelInput').value;
    setConfig(config);
    delete state.editedVertexId;
  };

  var handleEditVertexLabelCancel = function (target) {
    var state = node.dataset;
    delete state.editedVertexId;
    state.selectedVertexId = target.dataset.id;
  };

  var handleEditEdgeLabelOk = function (target) {
    var state = node.dataset;
    var config = getConfig();
    config.edges[target.dataset.index].label =
      document.querySelector('.EditEdgeLabelInput').value;
    setConfig(config);
    delete state.editedEdgeIndex;
  };

  var handleEditEdgeLabelCancel = function (target) {
    var state = node.dataset;
    delete state.editedEdgeIndex;
  };

  // Event map
  var events = {
    dragstart: function (event) {
      handleDelegatedEvent(event, {
        '.VertexConnector': function (target) {
          setTimeout(function () {
            node.dataset.vertexConnectorFrom = target.parentNode.dataset.id;
          });
        },
        '.Vertex': function (target) {
          node.dataset.selectedVertexId = target.dataset.id;
          delete node.dataset.selectedEdgeIndex;
          setTimeout(function () {
            node.dataset.draggedVertexId = target.dataset.id;
          });
        },
      });
    },

    dragend: function (event) {
      handleDelegatedEvent(event, {
        '.NewVertexAction': function (target) {
          var config = getConfig();
          var state = node.dataset;
          var id = Math.random();
          config.vertices.push({
            id: id,
            label: '',
            left: event.clientX,
            top: event.clientY,
          });
          setConfig(config);
          state.editedVertexId = id;
          setTimeout(function () { return document.querySelector('.EditVertexLabelInput').focus(); });
        },

        '.VertexConnector': function (target) {
          var config = getConfig();
          var state = node.dataset;
          if (state.dropVertexId) {
            config.edges.push({
              from: state.vertexConnectorFrom,
              label: '',
              to: state.dropVertexId,
            });
            setConfig(config);
          }
          delete state.vertexConnectorFrom;
          delete state.dropVertexId;
        },

        '.Vertex': function (target) {
          var id = target.dataset.id;
          var config = getConfig();
          var vertex = config.vertices.filter(function (vertex) { return vertex.id == id; })[0];
          vertex.left = event.clientX;
          vertex.top = event.clientY - target.clientHeight;
          setConfig(config);
          delete node.dataset.draggedVertexId;
        },
      });
    },

    dragover: function (event) {
      var config = getConfig();
      var state = node.dataset;

      event.preventDefault();
      handleDelegatedEvent(event, {
        '.Vertex': function (target) {
          if (!edgeExists(config, state.selectedVertexId, target.dataset.id)) {
            state.dropVertexId = target.dataset.id;
          }
        },
      });
    },

    dragleave: function (event) {
      var state = node.dataset;
      handleDelegatedEvent(event, {
        '.Vertex': function (target) {
          delete state.dropVertexId;
        },
      });
    },

    click: function (event) {
      var state = node.dataset;
      delete state.selectedVertexId;
      delete state.selectedEdgeIndex;

      handleDelegatedEvent(event, {
        '.Vertex': function (target) {
          state.selectedVertexId = target.dataset.id;
        },
        '.EditVertexLabelAction': function (target) {
          state.editedVertexId = target.dataset.id;
          setTimeout(function () { return document.querySelector('.EditVertexLabelInput').focus(); });
        },
        '.EditVertexLabelOk': handleEditVertexLabelOk,
        '.EditVertexLabelCancel': handleEditVertexLabelCancel,
        '.DeleteVertexAction': function (target) {
          var config = getConfig();
          var id = target.dataset.id;
          var vertex = getVertexById(config, id);
          config.edges = config.edges.filter(function (edge) { return edge.from != id && edge.to != id; });
          config.vertices.splice(config.vertices.indexOf(vertex), 1);
          setConfig(config);
        },

        '.Edge, .EdgeLabel': function (target) {
          state.selectedEdgeIndex = target.dataset.index;
        },
        '.EditEdgeLabelAction': function (target) {
          state.editedEdgeIndex = target.dataset.index;
          setTimeout(function () { return document.querySelector('.EditEdgeLabelInput').focus(); });
        },
        '.EditEdgeLabelOk': handleEditEdgeLabelOk,
        '.EditEdgeLabelCancel': handleEditEdgeLabelCancel,
        '.DeleteEdgeAction': function (target) {
          var config = getConfig();
          config.edges.splice(target.dataset.index, 1);
          setConfig(config);
        },
      });
    },

    keydown: function (event) {
      // Enter
      if (event.keyCode === 13) {
        handleDelegatedEvent(event, {
          '.EditVertexLabelInput': handleEditVertexLabelOk,
          '.EditEdgeLabelInput': handleEditEdgeLabelOk,
        });
      }

      // Esc
      if (event.keyCode === 27) {
        handleDelegatedEvent(event, {
          '.EditVertexLabelInput': handleEditVertexLabelCancel,
          '.EditEdgeLabelInput': handleEditEdgeLabelCancel,
        });
      }
    },
  };

  Object.keys(events).forEach(function (key) { return node.addEventListener(key, events[key]); });
};

bind('.ConceptMap', conceptMap);