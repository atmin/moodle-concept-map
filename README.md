# moodle-concept-map

## Intro

todo

## User Guide

todo

## Development

Development environment based on https://github.com/digitalsparky/moodle-vagrant

(Ubuntu 14.04, Apache, PHP5, PostgreSQL, Latest Moodle)

Requirements:

- Vagrant ( https://www.vagrantup.com/downloads.html )
- VirtualBox ( https://www.virtualbox.org/ )

Start virtual machine:

    vagrant up

Moodle will be available at http://moodle.local/

You will need to add a hosts file entry for:
moodle.local points to 192.168.33.10
(vargrant Landrush plugin automatically does that)

Authentication Details:

- username: admin
- password: Admin1!

Start development server, will watch src/ and recompile assets:

    npm start
