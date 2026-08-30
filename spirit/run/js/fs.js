'use strict';

const UTIL = spirit.core.util;
//const CALL = spirit.core.call;

const FS = spirit.core.fs;

const createType = spirit.core.util.ceateType;
const defineTypeMember = spirit.core.util.defineTypeMember;

let fso = UTIL.createType('fso','object');
fso.abstract = true;
UTIL.defineTypeMember(fso,'object','info');
UTIL.defineTypeMember(fso,'string','name');
UTIL.defineTypeMember(fso,'size','size');

let folder = UTIL.createType('folder','fso');

let file = UTIL.createType('file','fso')


//