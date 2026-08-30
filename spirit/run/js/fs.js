'use strict';

const UTIL = spirit.core.util;
//const CALL = spirit.core.call;

const FS = spirit.core.fs;

const createType = spirit.core.util.ceateType;
const defineTypeMember = spirit.core.util.defineTypeMember;

let file = UTIL.createType('file','object');



let directory = UTIL.createArrayType('directory','fso');

let folder = UTIL.createType('folder','arrayoffso');



//