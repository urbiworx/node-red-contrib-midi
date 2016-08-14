/**
 * Copyright 2016 Urbiworx, Nathanaël Lécaudé
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var midi = require('midi');

    function MidiInputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        var input = new midi.input();
        var vinput = new midi.input();
        var portCount = input.getPortCount();
        var portNames = [];

        node.warn(config.port);

        for (var i = 0; i < portCount; i++) {
            portNames.push(input.getPortName(i));
            node.warn(input.getPortName(i));
        }

        vinput.openVirtualPort("to Node-RED");
        vinput.on('message', function(deltaTime, message) {
            node.warn('m:' + message + ' d:' + deltaTime);
        });

        input.on('message', function(deltaTime, message) {
            node.warn('m:' + message + ' d:' + deltaTime);
        });

        input.openPort(0);

        node.on("close", function() {
            input.closePort();
            vinput.closePort();
        });

        RED.httpAdmin.get('/midi/input/ports', function(req, res, next) {
            res.end(JSON.stringify(portNames));
            return;
        });
    }

    RED.nodes.registerType("midi in", MidiInputNode);
};
