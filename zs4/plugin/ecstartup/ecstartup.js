var zs4 = require('../../static/zs4');
var xpress = require('express');
var debug = require('debug')('zs4ecstartup');

debug('ecstartup loading...');

var ecstartup;
if (zs4.is.node()) {
    ecstartup = exports;
}
else {
    ecstartup = new Object();
}

zs4.plugin.registerStyle('ecstartup/style.css');
zs4.plugin.registerScript('ecstartup/window.js');
