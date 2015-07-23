/**
 * Copyright 2015 Urbiworx
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
	 
	var midiManager=new (function(){
		var openPorts={};
		var listeners={};
		this.addListener=function(port,listener){
			if (typeof(openPorts[port])=="undefined"){
				var input = new midi.input();
				console.log("Open port "+parseInt(port,10));
				console.log("Port count:"+input.getPortCount());
				input.getPortName(0);
				listeners[port]=new Array();
				openPorts[port]={
					input:input,
					addListener:function(portListener){
						console.log("push "+ port);
						listeners[port].push(portListener);
					},
					removeListener:function(portListener){
						var index = listeners[port].indexOf(portListener);
						listeners[port].splice(index, 1);
						if (listeners[port].length==0){
							input.closePort();
							delete openPorts[port];
							delete listeners[port];
						}
					}
				}
				input.on('message', function(deltaTime, message) {
					console.log("!"+port+"   "+listeners[port].length);
					for (var i=0;i<listeners[port].length;i++){
						listeners[port][i](deltaTime, message);
					}
				});
				input.openPort(parseInt(port,10));
				
			}
			openPorts[port].addListener(listener);
		}
		this.removeListener=function(port,listener){
			openPorts[port].removeListener(listener);
		}
		
	})();

    function MidiNode(n) {
        RED.nodes.createNode(this,n);
		var that=this;
        this.name = n.name || "";
		this.filtermessage = (typeof(n.filtermessage)=="undefined")?"":n.filtermessage;
		this.port = (typeof(n.port)=="undefined")?"0":n.port;
		var listener = function(deltaTime, message) {
			if (that.filtermessage!==""){
				if (that.filtermessage===message.join()){
					that.send({payload:{message:message,deltaTime:deltaTime}});
				}
			} 
			else {
				that.send({payload:{message:message,deltaTime:deltaTime}});
			}
		};
		midiManager.addListener(that.port, listener);
		this.on("close",function() {
			midiManager.removeListener(that.port, listener);
		});
	

    }
    RED.nodes.registerType("midi",MidiNode);

}
