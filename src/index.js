import {h, bind} from 'funponent/src/funponent';

const vertex = data => {
  const {
    label,
    left,
    top,
  } = data;
  const border = '1px solid #999';
  const borderRadius = '5px';

  return (
    <div style={`
      border: ${border};
      border-radius: ${borderRadius};
      position: absolute;
      left: ${left}px;
      top: ${top}px;
      padding: 0.5em 1em;
    `}>
      {label}
    </div>
  );
};

const edge = data => {
  return (
    <div>
      <div>{data.from.label}</div>
      <div>{data.to.label}</div>
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

        <div style={`
          position: absolute;
          left: 0;
          top: 0;
          width: 300px;
          height: 0;
          border-top: 1px solid black;
          transform: rotate(30deg) translate(100px, 100px);
        `} />
      </div>

      <a href="http://jsfiddle.net/NPC42/25E8W/8/">JSFiddle how to draw arbitrary line in 1 HTML element</a>
    </body>
  );
};

bind('.moodle-concept-map', conceptMap);
