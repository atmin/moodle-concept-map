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
  marginLeft: '0.25em',
  padding: '2px',
  textAlign: 'center',
};

const modalOverlay = (
  <div
    className={'ModalOverlay'}
    style={{
      backgroundColor: '#fff',
      opacity: 0.8,
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
    }} />
);

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
    dropVertexId,
    editing,
    id,
    label,
    left,
    selected,
    top,
    vertexConnectorFrom,
  } = data;

  let border = theme.vertexBorder;
  if (selected || dropVertexId == id) {
    border = theme.selectedVertexBorder;
  }
  if (dragged) {
    border = theme.edgeBorderDragging;
  }

  return (
    <div>
      {editing ? modalOverlay : null}

      <div
        className={'Vertex'}
        data-id={id}
        draggable={'true'}
        style={{
          background: dropVertexId == id ? '#EEEEFF' : theme.vertexBackground,
          border,
          borderRadius: theme.vertexBorderRadius,
          minHeight: '1em',
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          padding: '0.5em 1em',
          transform: 'translate(-50%, -50%)',
          zIndex: editing ? 101 : 1,
        }}>

        {editing ? (
          <div>
            <input
              className={'EditVertexLabelInput'}
              data-id={id}
              style={{
                border: '1px solid #999',
                borderRadius: '1em',
                fontSize: '100%',
                padding: '0.25em 1em',
                width: '5em',
              }}
              value={label} />
            <a
              className={'EditVertexLabelOk'}
              data-id={id}
              style={{
                ...symbolStyle,
                color: 'green',
              }}
              title={'OK'}>✓</a>
            <a
              className={'EditVertexLabelCancel'}
              data-id={id}
              style={{
                ...symbolStyle,
                color: 'red',
              }}
              title={'Cancel'}>×</a>
          </div>
        ) : label}

        {selected ? (
          <a
            className={'VertexConnector'}
            draggable={'true'}
            style={{
              color: 'white',
              display: (vertexConnectorFrom == id || dragged) ? 'none' : 'block',
              background: theme.edgeConnectorBackground,
              borderRadius: '50%',
              position: 'absolute',
              left: 'calc(50% - 0.75em)',
              top: 'calc(100% - 0.5em)',
              width: '1.5em',
              height: '1.5em',
              textAlign: 'center',
            }}
            title={'Drag connector to another vertex to create edge'}>☍</a>
        ) : null}
        {selected ? (
          <div
            className={'ActionButtonBar'}
            style={{
              display: (vertexConnectorFrom == id || dragged) ? 'none' : 'block',
              position: 'absolute',
              width: '10em',
              left: 'calc(100% + 0.5em)',
              top: '50%',
              transform: 'translateY(-50%)',
            }}>
            <a
              className={'EditVertexLabelAction'}
              data-id={id}
              style={{
                ...symbolStyle,
              }}
              title={'Edit vertex label'}>✎</a>
            <a
              className={'DeleteVertexAction'}
              data-id={id}
              style={{
                ...symbolStyle,
                color: 'red',
              }}
              title={'Delete vertex'}>␡</a>
          </div>
        ) : null}
      </div>
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

  return (
    <div>
      {editing ? modalOverlay : null}
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
          background: label ? theme.edgeLabelBackground : 'transparen',
          position: 'absolute',
          left: `${labelLeft}${units}`,
          top: `${labelTop}${units}`,
          transform: 'translate(-50%, -50%)',
          zIndex: editing ? 101 : 'default',
        }}>
        {editing ? (
          <div>
            <input
              className={'EditEdgeLabelInput'}
              data-index={index}
              style={{
                border: '1px solid #999',
                borderRadius: '1em',
                fontSize: '100%',
                padding: '0.25em 1em',
                width: '5em',
              }}
              value={label} />
            <a
              className={'EditEdgeLabelOk'}
              data-index={index}
              style={{
                ...symbolStyle,
                color: 'green',
              }}
              title={'OK'}>✓</a>
            <a
              className={'EditEdgeLabelCancel'}
              data-index={index}
              style={{
                ...symbolStyle,
                color: 'red',
              }}
              title={'Cancel'}>×</a>
          </div>
        ) : (
          <span
            className={'EdgeLabel'}
            data-index={index}
            style={{
              cursor: 'pointer',
              marginRight: '0.5em',
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
          dropVertexId: data.dropVertexId,
          editing: item.id == data.editedVertexId,
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
        (edge.from == v1 && edge.to == v2) ||
        (edge.from == v2 && edge.to == v1)
      )
      .length > 0
  );

  // Event handlers
  const handleEditVertexLabelOk = target => {
    const config = getConfig();
    const state = node.dataset;
    getVertexById(config, target.dataset.id).label =
      document.querySelector('.EditVertexLabelInput').value;
    setConfig(config);
    delete state.editedVertexId;
  };

  const handleEditVertexLabelCancel = target => {
    const state = node.dataset;
    delete state.editedVertexId;
    state.selectedVertexId = target.dataset.id;
  };

  const handleEditEdgeLabelOk = target => {
    const state = node.dataset;
    const config = getConfig();
    config.edges[target.dataset.index].label =
      document.querySelector('.EditEdgeLabelInput').value;
    setConfig(config);
    delete state.editedEdgeIndex;
  };

  const handleEditEdgeLabelCancel = target => {
    const state = node.dataset;
    delete state.editedEdgeIndex;
  };

  // Event map
  const events = {
    dblclick: event => {
      const config = getConfig();
      const state = node.dataset;
      const id = Math.random();
      if (event.target === node) {
        config.vertices.push({
          id,
          label: '',
          left: event.clientX,
          top: event.clientY,
        });
        setConfig(config);
        state.editedVertexId = id;
        setTimeout(() => document.querySelector('.EditVertexLabelInput').focus());
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
          const config = getConfig();
          const state = node.dataset;
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
        '.Vertex': target => {
          const id = target.dataset.id;
          const config = getConfig();
          const vertex = config.vertices.filter(vertex => vertex.id == id)[0];
          vertex.left = event.clientX;
          vertex.top = event.clientY - target.clientHeight;
          setConfig(config);
          delete node.dataset.draggedVertexId;
        },
      });
    },

    dragover: event => {
      const config = getConfig();
      const state = node.dataset;

      event.preventDefault();
      handleDelegatedEvent(event, {
        '.Vertex': target => {
          if (!edgeExists(config, state.selectedVertexId, target.dataset.id)) {
            state.dropVertexId = target.dataset.id;
          }
        },
      });
    },

    dragleave: event => {
      const state = node.dataset;
      handleDelegatedEvent(event, {
        '.Vertex': target => {
          delete state.dropVertexId;
        },
      });
    },

    click: event => {
      const state = node.dataset;
      delete state.selectedVertexId;
      delete state.selectedEdgeIndex;

      handleDelegatedEvent(event, {
        '.Vertex': target => {
          state.selectedVertexId = target.dataset.id;
        },
        '.EditVertexLabelAction': target => {
          state.editedVertexId = target.dataset.id;
          setTimeout(() => document.querySelector('.EditVertexLabelInput').focus());
        },
        '.EditVertexLabelOk': handleEditVertexLabelOk,
        '.EditVertexLabelCancel': handleEditVertexLabelCancel,
        '.DeleteVertexAction': target => {
          const config = getConfig();
          const id = target.dataset.id;
          const vertex = getVertexById(config, id);
          config.edges = config.edges.filter(edge => edge.from != id && edge.to != id);
          config.vertices.splice(config.vertices.indexOf(vertex), 1);
          setConfig(config);
        },

        '.Edge, .EdgeLabel': target => {
          state.selectedEdgeIndex = target.dataset.index;
        },
        '.EditEdgeLabelAction': target => {
          state.editedEdgeIndex = target.dataset.index;
          setTimeout(() => document.querySelector('.EditEdgeLabelInput').focus());
        },
        '.EditEdgeLabelOk': handleEditEdgeLabelOk,
        '.EditEdgeLabelCancel': handleEditEdgeLabelCancel,
        '.DeleteEdgeAction': target => {
          const config = getConfig();
          config.edges.splice(target.dataset.index, 1);
          setConfig(config);
        },
      });
    },

    keydown: event => {
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

  Object.keys(events).forEach(key => node.addEventListener(key, events[key]));
};

bind('.ConceptMap', conceptMap);
