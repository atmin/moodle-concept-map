import {h, bind} from 'funponent/src/funponent';

const conceptMap = data => {
  const {vertices, edges} = JSON.parse(data.config);
  return (
    <body>
      <p>
        {vertices.length + ''} vertices
      </p>
      <p>
        {edges.length + ''} edges
      </p>
      <a href="http://jsfiddle.net/NPC42/25E8W/8/">JSFiddle how to draw arbitrary line in 1 HTML element</a>
    </body>
  );
};

bind('.moodle-concept-map', conceptMap);
