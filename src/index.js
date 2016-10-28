import {h, bind} from 'funponent/src/funponent';
import './drag-drop-touch';

const theme = {
  edgeBorder: '1px solid #666',
  edgeLabelBackground: 'rgba(255, 255, 255, 0.8)',
  vertexBackground: 'white',
  vertexBorder: '1px solid #999',
  vertexBorderRadius: '5px',
};

const lineTransform = (x1, y1, x2, y2, units) => {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.acos(deltaX / length);
  return `transform: rotate(${angle}rad); width: ${length}${units}`;
};

const vertex = data => {
  const {
    id,
    label,
    left,
    top,
  } = data;

  return (
    <div
      data-id={id}
      draggable={'true'}
      style={`
        background: ${theme.vertexBackground};
        border: ${theme.vertexBorder};
        border-radius: ${theme.vertexBorderRadius};
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        padding: 0.5em 1em;
        transform: translate(-50%, -50%);
        z-index: 1;
      `}>
      {label}
    </div>
  );
};

const edge = data => {
  const {
    from,
    label,
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
      <div
        className={'Edge'}
        style={`
          left: ${from.left}${units};
          top: ${from.top}${units};
          height: ${edgeThickness}${units};
          ${lineTransform(from.left, from.top, to.left, to.top, units)}
        `} />
      <div style={`
        background: ${theme.edgeLabelBackground};
        position: absolute;
        left: ${labelLeft}${units};
        top: ${labelTop}${units};
        transform: translate(-50%, -50%);
      `}>
        {label}
      </div>
    </div>
  );
};

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
      <div style={`
        position: relative;
      `}>
        {edges.map(item => edge({
          ...item,
          from: verticesById[item.from],
          to: verticesById[item.to],
        }))}

        {vertices.map(item => vertex(item))}
      </div>
    </body>
  );
};

bind('.ConceptMap', conceptMap);







const dragVertex = event => {
  const root = document.querySelector('.ConceptMap');
  const id = event.target.dataset.id;
  const config = JSON.parse(root.dataset.config);
  const vertex = config.vertices.filter(vertex => vertex.id == id)[0];
  vertex.left += event.offsetX;
  vertex.top += event.offsetY;
  root.dataset.config = JSON.stringify(config);
};

document.addEventListener('drag', dragVertex);
document.addEventListener('dragend', dragVertex);
