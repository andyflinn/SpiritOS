'use strict';

const UTIL = spirit.core.util;
const FS = spirit.core.fs;

const createType = spirit.core.util.createType;
const defineTypeMember = spirit.core.util.defineTypeMember;

let discobject = UTIL.createType('discobject','object');
discobject.abstract = true;

let file = UTIL.createType('file','object');
defineTypeMember(file,'size','size');
defineTypeMember(file,'string','mimetype');

let folder = UTIL.createArrayType('folder','object');

 // ******************************************************************
 // functions that are generated in a node environment only

if (spirit.core.const.IS_NODE) {

    const NODE = spirit.core.node;
}


//