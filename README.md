# moodle-concept-map


## Intro

`atmin/moodle-concept-map` is a Moodle Database Activity field type representing a
[Concept map](https://en.wikipedia.org/wiki/Concept_map). Vertices and edges
can have labels. If a vertex label is omitted, it becomes invisible while still
connecting edges, thus arbitrary shapes consisting of straight lines can be drawn.

[Online demo of the component](https://atmin.github.io/moodle-concept-map/)


## Moodle instalation

```
cd /path/to/moodle
cd mod/data/field
git clone https://github.com/atmin/moodle-concept-map.git conceptmap
```

## User Guide

Use it like any other database field type. There aren't any specific configuration options.
When adding/editing a database entry, concept map is editable. Click to select a vertex or edge,
context actions will be revealed. Drag blue (+) circle to create a new vertex. Drag vertices
to reorder them.


## Development

Development environment based on https://github.com/tmuras/moosh

(Ubuntu 16.04, Apache, PHP7, MySQL, Moodle 3.1)

Requirements:

- Vagrant ( https://www.vagrantup.com/downloads.html )
- VirtualBox ( https://www.virtualbox.org/ )
- Node ( https://nodejs.org )

Start virtual machine:

    vagrant up

Moodle will be available at http://192.168.33.10/moodle

Authentication Details:

- username: admin
- password: a

Install JavaScript dependencies:

    npm install

Start development server, will watch `src/` and recompile assets:

    npm start

Check `package.json` scripts.


## Contributing

Pull requests are welcome. Please, open an issue first to discuss.
