<?php
///////////////////////////////////////////////////////////////////////////
//                                                                       //
// NOTICE OF COPYRIGHT                                                   //
//                                                                       //
// Moodle - Modular Object-Oriented Dynamic Learning Environment         //
//          http://moodle.org                                            //
//                                                                       //
// Copyright (C) 1999-onwards Moodle Pty Ltd  http://moodle.com          //
//                                                                       //
// This program is free software; you can redistribute it and/or modify  //
// it under the terms of the GNU General Public License as published by  //
// the Free Software Foundation; either version 2 of the License, or     //
// (at your option) any later version.                                   //
//                                                                       //
// This program is distributed in the hope that it will be useful,       //
// but WITHOUT ANY WARRANTY; without even the implied warranty of        //
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         //
// GNU General Public License for more details:                          //
//                                                                       //
//          http://www.gnu.org/copyleft/gpl.html                         //
//                                                                       //
///////////////////////////////////////////////////////////////////////////

class data_field_conceptmap extends data_field_base {
    var $type = 'conceptmap';

    function display_add_field($recordid = 0, $formdata = null) {
        global $CFG, $DB, $OUTPUT;
        $fieldname = 'field_' . $this->field->id;
        $value = json_encode(array(
          vertices => [],
          edges => [],
        ));

        if ($formdata) {
            $value = $formdata->$fieldname;
        } else if ($recordid) {
            if ($content = $DB->get_record('data_content', array('fieldid'=>$this->field->id, 'recordid'=>$recordid))) {
                $value = $content->content;
            }
        }
        $conceptmap = $this->display_conceptmap($value);
        $escaped_json = htmlspecialchars($value);
        return "
          <div>
            <input name='$fieldname' type='hidden' value='$escaped_json'>
            $conceptmap
          </div>
        ";
    }

    function update_content($recordid, $value, $name='') {
        global $DB;
        $content = new stdClass();
        $content->fieldid = $this->field->id;
        $content->recordid = $recordid;
        $content->content = json_encode(json_decode($value));
        if ($oldcontent = $DB->get_record('data_content', array('fieldid'=>$this->field->id, 'recordid'=>$recordid))) {
            $content->id = $oldcontent->id;
            return $DB->update_record('data_content', $content);
        } else {
            return $DB->insert_record('data_content', $content);
        }
    }

    function display_browse_field($recordid, $template) {
        global $DB;
        if ($content = $DB->get_record('data_content', array('fieldid'=>$this->field->id, 'recordid'=>$recordid))) {
            if (strlen($content->content) < 1) {
                return false;
            }
            return $this->display_conceptmap($content->content, true);
        }
        return false;
    }

    function display_conceptmap($content, $readonly) {
        $fieldname = 'field_' . $this->field->id;
        $escaped_json = htmlspecialchars($content);
        $is_readonly = json_encode($readonly);
        $script = file_get_contents(__DIR__ . '/js/moodle-concept-map.js');
        return "
          <style>
            .Vertex:hover {
              cursor: move;
            }
            .Edge {
              position: absolute;
              transform-origin: top left;
            }
            .Edge:hover {
              cursor: pointer;
            }
            .Edge:before {
              content: '';
              display: block;
              height: 0;
              width: 100%;
              border-top: 1px solid #666;
            }
            .Edge.--selected:before,
            .Edge.--selected:hover:before {
              border-top: 2px solid blue;
            }
            .Edge:hover:before {
              border-top: 1px solid #AAA;
            }
          </style>
          <div style='
            height: 600px;
            width: 60vw;
            position: relative;
          '>
            <div
              class='ConceptMap'
              data-config='$escaped_json'
              data-field-selector='[name=$fieldname]'
              data-readonly='$is_readonly'
              style='
                width: 150%;
                height: 100%;
            '><div>
          </div>
          <script>$script</script>
        ";
    }
}
