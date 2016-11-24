import {h, bind} from 'funponent/src/funponent';
import './drag-drop-touch';

const theme = {
  edgeBorder: '1px solid #666',
  edgeBorderDragging: '1px dashed #666',
  edgeConnectorBackground: 'blue',
  edgeLabelBackground: 'rgba(255, 255, 255, 0.8)',
  vertexBackground: 'white',
  vertexBorder: '1px solid #999',
  selectedVertexBorder: '1px solid blue',
  vertexBorderRadius: '5px',
};

const lineTransform = (x1, y1, x2, y2, units) => {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  let angle = Math.acos(deltaX / length);
  if (deltaY < 0) {
    angle = -angle;
  }
  return {
    transform: `rotate(${angle}rad)`,
    width: `${length}${units}`,
  };
};

const vertex = data => {
  const {
    dragged,
    editing,
    id,
    label,
    left,
    selected,
    top,
    vertexConnectorFrom,
  } = data;

  let border = theme.vertexBorder;
  if (selected) {
    border = theme.selectedVertexBorder;
  }
  if (dragged) {
    border = theme.edgeBorderDragging;
  }

  return (
    <div
      className={'Vertex'}
      data-id={id}
      draggable={'true'}
      style={{
        background: theme.vertexBackground,
        border,
        borderRadius: theme.vertexBorderRadius,
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        padding: '0.5em 1em',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
      }}>
      <span
        contenteditable={editing ? '' : null}
        style={{cursor: 'text'}}>
        {label}
      </span>
      {selected ? (
        <div
          className={'VertexConnector'}
          draggable={'true'}
          style={{
            display: (vertexConnectorFrom == id || dragged) ? 'none' : '',
            background: theme.edgeConnectorBackground,
            borderRadius: '50%',
            position: 'absolute',
            left: 'calc(50% - 0.5em)',
            top: 'calc(100% - 0.5em)',
            width: '1em',
            height: '1em',
          }} />
      ) : null}
    </div>
  );
};

const edge = data => {
  const {
    editing,
    from,
    index,
    label,
    selected,
    to,
  } = data;

  const units = 'px';
  const edgeThickness = '10';
  const width = to.left - from.left;
  const height = to.top - from.top;
  const labelLeft = from.left + width / 2;
  const labelTop = from.top + height / 2;

  const symbolStyle = {
    backgroundColor: '#fff',
    border: '1px solid #999',
    borderRadius: '50%',
    color: '#333',
    cursor: 'pointer',
    display: 'inline-block',
    width: '1em',
    lineHeight: '1em',
    fontSize: '130%',
    marginRight: '1px',
    padding: '2px',
    textAlign: 'center',
  };

  return (
    <div>
      <div
        className={`Edge${selected ? ' --selected' : ''}`}
        data-index={index}
        style={{
          left: `${from.left}${units}`,
          top: `${from.top}${units}`,
          height: `${edgeThickness}${units}`,
          ...lineTransform(from.left, from.top, to.left, to.top, units),
        }} />
      <div
        style={{
          background: theme.edgeLabelBackground,
          position: 'absolute',
          left: `${labelLeft}${units}`,
          top: `${labelTop}${units}`,
          transform: 'translate(-50%, -50%)',
        }}>
        {editing ? (
          <input value={label} />
        ) : (
          <span
            className={'EdgeLabel'}
            data-index={index}
            style={{
              marginRight: '0.5em'
            }}>{label}</span>
        )}

        {selected ? (
          <div
            className={'ActionButtonBar'}
            style={{
              position: 'absolute',
              width: '10em',
              left: '100%',
              top: '-20%',
            }}>
            <a
              className={'EditEdgeLabelAction'}
              data-index={index}
              style={{
                ...symbolStyle,
              }}
              title={'Edit edge label'}>✎</a>
            <a
              className={'DeleteEdgeAction'}
              data-index={index}
              style={{
                ...symbolStyle,
                color: 'red',
              }}
              title={'Delete edge'}>␡</a>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const helpPane = (
  <ul style={{
    fontSize: '60%',
    listStyleType: 'none',
    margin: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  }}>
    <li>Double-tap map to add node</li>
    <li>Tap a node to select</li>
    <li>Drag a node to move</li>
  </ul>
);

const conceptMap = data => {
  const {
    edges,
    vertices,
  } = JSON.parse(data.config);

  const verticesById = vertices.reduce((result, item) => {
    result[item.id] = item;
    return result;
  }, {});

  return (
    <body>
      <div style={{position: 'relative'}}>
        {edges.map((item, index) => edge({
          ...item,
          editing: index == data.editedEdgeIndex,
          from: verticesById[item.from],
          index: index,
          selected: index == data.selectedEdgeIndex,
          to: verticesById[item.to],
        }))}

        {vertices.map(item => vertex({
          ...item,
          dragged: item.id == data.draggedVertexId,
          vertexConnectorFrom: data.vertexConnectorFrom,
          selected: item.id == data.selectedVertexId,
        }))}

        {helpPane}
      </div>
    </body>
  );
};

// All events are handled here
conceptMap.init = node => {

  // Utility functions
  const handleDelegatedEvent = (event, selectorHandlers) => {
    const target = event.target;
    const handlerKey = Object.keys(selectorHandlers)
      .filter(selector => target.matches(selector))
      .shift();
    (selectorHandlers[handlerKey] || Function.prototype)(target);
  };
  const getConfig = () => JSON.parse(node.dataset.config);
  const setConfig = config => node.dataset.config = JSON.stringify(config);;
  const getVertexById = (config, id) => (
    config.vertices
      .filter(vertex => vertex.id == id)
      .shift()
  );
  const edgeExists = (config, v1, v2) => (
    config.edges
      .filter(edge =>
        (edge.from, edge.to) == (v1, v2) ||
        (edge.from, edge.to) == (v2, v1)
      )
      .length > 0
  );

  // Event map
  const events = {
    // focusout: event => {
      // handleDelegatedEvent(event, {
        // '.Vertex': target => {
          // const config = getConfig();
          // const vertex = getVertexById(config, target.parentNode.dataset.id);
          // const label = target.innerText;
          // if (label) {
            // // finish editing, set new label
            // delete vertex.editing;
            // vertex.label = label;
          // } else {
            // // delete this vertex and participating edges
            // config.edges = config.edges.filter(
              // edge => edge.from != vertex.id && edge.to != vertex.id
            // );
            // config.vertices.splice(config.vertices.indexOf(vertex), 1);
          // }
          // setConfig(config);
        // },
      // });
    // },

    dblclick: event => {
      const config = getConfig();
      if (event.target === node) {
        config.vertices.push({
          id: Math.random(),
          label: 'Untitled',
          left: event.offsetX,
          top: event.offsetY,
        });
        setConfig(config);
      }
    },

    dragstart: event => {
      handleDelegatedEvent(event, {
        '.VertexConnector': target => {
          setTimeout(() => {
            node.dataset.vertexConnectorFrom = target.parentNode.dataset.id;
          });
        },
        '.Vertex': target => {
          node.dataset.selectedVertexId = target.dataset.id;
          delete node.dataset.selectedEdgeIndex;
          setTimeout(() => {
            node.dataset.draggedVertexId = target.dataset.id;
          });
        },
      });
    },

    dragend: event => {
      handleDelegatedEvent(event, {
        '.VertexConnector': target => {
          delete node.dataset.vertexConnectorFrom;
        },
        '.Vertex': target => {
          const id = target.dataset.id;
          const config = getConfig();
          const vertex = config.vertices.filter(vertex => vertex.id == id)[0];
          vertex.left += event.offsetX;
          vertex.top += event.offsetY - target.clientHeight;
          setConfig(config);
          delete node.dataset.draggedVertexId;
        },
      });
    },

    dragover: event => {
      const target = event.target;
      node.dataset.dropVertexId = target.matches('.Vertex') ? target.dataset.id : null;
    },

    click: event => {
      const state = node.dataset;
      state.selectedVertexId = null;
      state.selectedEdgeIndex = null;

      handleDelegatedEvent(event, {
        '.Vertex': target => {
          state.selectedVertexId = target.dataset.id;
        },
        '.Edge, .EdgeLabel': target => {
          state.selectedEdgeIndex = target.dataset.index;
        },
        '.EditEdgeLabelAction': target => {
          state.editedEdgeIndex = target.dataset.index;
        },
        '.DeleteEdgeAction': target => {
          const config = getConfig();
          config.edges.splice(target.dataset.index, 1);
          setConfig(config);
        },
      });
    },
  };

  Object.keys(events).forEach(key => node.addEventListener(key, events[key]));
};

bind('.ConceptMap', conceptMap);
