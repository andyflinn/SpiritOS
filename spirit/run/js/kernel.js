// the kernel
// this file 

'use strict';
{ // ******************************************************************

const isNode = () =>
  typeof process !== 'undefined' &&
  !!process.versions &&
  !!process.versions.node;

const isBrowser = function() { return !isNode(); }  

// these are the main constants for the SpiritOS kernel
const AUTHOR = 'Andy Flinn, from AndyFlinn.com';
const COPYRIGHT = 'Copyright (c) 2024 Andy Flinn, from AndyFlinn.com';
const VERSION = '0.0.1';
const SPIRIT_NAME = 'SpiritOS';

// constants
const DEBUG = true;

// these are used for base-26 conversion, where z=0, a=1, b=2, ..., y=25
const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxyz";
const POWERS_OF_26 = [1,26,26**2,26**3,26**4,26**5,26**6,26**7,26**8,26**9,26**10,26**11];

//const ICON = require('./constants/icons.js');

// this here is the main spirit object, which contains all the core functionality of the SpiritOS kernel 
const spirit = {
  type: SPIRIT_NAME,
  core: {
    const: {
      BASE26_DIGITS: BASE26_DIGITS,
      KERNEL_DEBUG: DEBUG,
      POWERS_OF_26: POWERS_OF_26,
      IS_NODE:isNode(),
      IS_BROWSER:isBrowser(),
    },
    info: {
      debug: DEBUG,
    },
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {},
    call: {},
    fs:{},
    type:{},
  },
  value:{},
};


// use this for old fashioned console.log debugging, which can be turned on and off with the DEBUG constant
let print = spirit.core.util.print = function(str){
  if (DEBUG) {
    console.log(str);
  }
}

// use this for error messages, which will always be printed to the console
let error = spirit.core.util.error = function(str){
  console.error('ERROR: ' + str);
  return {
    error:{
      string:str,
    }
  }; 
}

let isName = spirit.core.util.isName = function(str) {
  if (str == null) return false;
  if (str == undefined) return false;
  return /^[a-z]+$/.test(str);
}

let numberToBase26 = spirit.core.util.numberToBase26 = function(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null;
  if (n === 0) return 'z';

  let active = false;
  let result = '';
  let num = n;
  let remainder = 0;
  let index = 0;
  for (let i = POWERS_OF_26.length - 1; i >= 0; i--) {
    if (!active && num < POWERS_OF_26[i]) {
      continue;
    }
    else {
      active = true;
    }

    if (i > 0) {
      remainder = num % POWERS_OF_26[i];
      index = (num - remainder) / POWERS_OF_26[i];
    }else{ 
      remainder = num;
      index = remainder;
    }
  
    result += BASE26_DIGITS[index];
    num = remainder;
  }

  return result;
}

let base26ToNumber = spirit.core.util.base26ToNumber = function(str) {
  if (!isName(str)) return null;

  // Special case for zero
  if (str === 'z') return 0;

  // create a loop that iterates in reverse over each character in the string
  let num = 0; let power = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const ch = str[i];
    const digit = BASE26_DIGITS.indexOf(ch);
    const factor = 26**power;
    num += digit * factor;
    power++;
  }

  return num;
}

let isType = spirit.core.util.isType = function(typename){
  if (!isName(typename)) return false;
  if (!spirit.core.type.hasOwnProperty(typename)) return false;
  return true;
}

let createType = spirit.core.util.createType = function(name,parenttype){

  // check if input arguments are both valid names
  if (!isName(name)) {
    error("createType: name '" + name + "' is not a valid name");
    return null;
  }

  if (!isName(parenttype)) {
    error("createType: parenttype '" + parenttype + "' is not a valid name");
    return null;
  }

  // check if spirit.type already had a member
  // called with the key parenttype. if it does,
  // return null
  if (parenttype != "type"){
    if (!spirit.core.type.hasOwnProperty(parenttype)) {
      error("createType: parenttype '" + parenttype + "' does not exist");
      return null;
    }
  }

  // if the type already exists, fail as well
  if (spirit.core.type.hasOwnProperty(name)) {
    error("createType: the type '" + name + "' already exists");
    return null;
  }


  let ptyp = null;
  if (parenttype == "type"){
    ptyp = spirit.core.type;
  } else {
    if (!spirit.core.type.hasOwnProperty(parenttype)) {
      error("createType: parenttype '" + parenttype + "' does not exist");
      return null;
    }
    ptyp = spirit.core.type[parenttype];
  }

  // get shortcuts to type and parent objects
  let newtype = spirit.core.type[name] = {
    //name: name,
    parenttype: parenttype,
  };
  

  if (parenttype == "type") return newtype;
    
    // copy all properties from parenttype to name
    for (const key in ptyp){
      if (key == "name" || key == "parenttype"  || key == "abstract" ) continue;
      if (typeof ptyp[key] === 'function') continue; 
      //print("copying " + key + " from " + key + " to " + name);
      if (newtype.hasOwnProperty(key)) continue;
      newtype[key] = JSON.parse(JSON.stringify(ptyp[key]));
    }

  return newtype;
}

let isTypeEnheritedFrom = spirit.core.util.isTypeEnheritedFrom = function(typename,ancestortypename){
  if (!isType(typename)){
     return false;}
  if (!isType(ancestortypename)) {
    return false;
  }
  if (typename == ancestortypename) {return false;}

  while (   isName(typename)
        &&  typename != "type"
        &&  spirit.core.type.hasOwnProperty(typename)
        ){
          if (typename == ancestortypename) return true;
          typename = spirit.core.type[typename].parenttype;
    }

  return false;
}

let bool = createType("boolean","type");{
  bool.value = false;
  bool.validate = function(value){
    if (!(typeof value === 'boolean')) return false;
    return true;
  }
}

let flag = createType("flag","boolean");{
  flag.value = true;
}

let abstract = createType("abstract","flag");
let isarray = createType("isarray","flag");
let nostore = createType("nostore","flag");
let constant = createType("constant","flag");
let readonly = createType("readonly","flag");
let serveronly = createType("serveronly","flag");

let number = createType("number","type");{
  number.min = Number.MIN_VALUE;
  number.max = Number.MAX_VALUE;
  number.value = 0;
  number.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (value < this.min || value > this.max) return false;
    return true;
  };
}

let integer = createType("integer","number");{
  integer.min = Number.MIN_SAFE_INTEGER;
  integer.max = Number.MAX_SAFE_INTEGER;
  integer.validate = function(value){
    if (!Number.isInteger(value)) return false;
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (Math.round(value) !== value) return false;
    if (value < this.min || value > this.max) return false;
    return true;
  };
}

let counter = createType("counter","integer");{
  counter.min = 0;
}

let size = createType("size","integer");{
  size.min = 0;
}

let float = createType("float","number");{
}

let string = createType("string","type");{
  string.maxlength = 256;
  string.value = "";
  string.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'string')) return false;
    if (value.length > string.maxlength) return false;
    return true;
  }
}

let name = createType("name","string");{
  name.validate = function(value){
    if (!isName(value)) return false;
    return true;
  }
}

let text = createType("text","string");{
  text.maxlength = 65536;
}

let js = createType("js","text");{
  js.validate = function(value){
    try{
      let executeMe = new Function("object", codeString);
    } catch(e){
      return false;
    }
    return true;
  }
}

let object = createType("object","type");{
  object.abstract = true;
  object.value = {};
  object.members = {};
  object.validate = function(value){
    if (!(typeof value === 'object')) return false;
    return true;
  }
}

let defineTypeMember = spirit.core.util.defineTypeMember = function(typeobject,typeName,memberName){
  if (!isName(memberName)) {
    return null;
  }
 
  if (typeobject.members.hasOwnProperty(memberName)) return null;

  let type = spirit.core.type[typeName];
  let parenttype = spirit.core.type[typeobject.parenttype];
  
  typeobject.members[memberName] = typeName;
  
  let member = typeobject.value[memberName] = {
  //  name: memberName,
    type: typeName,
  };

  if (!isTypeEnheritedFrom(typeName,"object")){
    typeobject.value[memberName].value = spirit.core.type[typeName].value;
  } else {
    typeobject.value[memberName].value = JSON.parse(JSON.stringify(spirit.core.type[typeName].value));
  }

  return member;
}

let array = createType("array","object");{
  array.abstract = true;
  array.value = {};
}

let createArrayType = spirit.core.util.createArrayType = function(newtypename,memberType){
  if (!isType(memberType)){
    error("createArrayType: memberType '" + memberType + "' is not a valid type");
    return null;
  }

  let mType = spirit.core.type[memberType];
  
  if (isType(newtypename)){
    error('createArrayType: type ' + newtypename + ' already exists');
    return null;
  }

  let arraytype = createType(newtypename,'array');

  arraytype.membertype = memberType;

  return arraytype;
}

let create = createType("create","object");
defineTypeMember(create,"name","typename");
defineTypeMember(create,"name","membername");


// this function must allways be invoked
// using the call function, in order to
// set 'this'
let instantiateTypeName =
spirit.core.call.instantiateTypeName = function(typeName,instanceName){
  

  if (this == null) {
  error("instantiateTypeName: 'this' is null");
    return null;
  }
  if (this == undefined) {
    error("instantiateTypeName: 'this' is undefined");
    return null;
  }
  if (typeof this !== 'object') {
    error("instantiateTypeName: 'this' is not an object");
    return null;
  }
  if (!this.hasOwnProperty('type') && !this.hasOwnProperty('parenttype')) {
    error("instantiateTypeName: 'this' has no valid type property");
    return null;
  }
  if (!this.hasOwnProperty('value')) {
    error("instantiateTypeName: 'this' has no 'value' property");
    return null;
  }
  if (typeName === "object") {
    error("instantiateTypeName: typeName '" + typeName + "' is not a valid type");
    return null;
  }

  if (!isName(typeName) || !isName(instanceName)) {
    error("instantiateTypeName: invalid name '" + instanceName + "' provided");
    return null;
  }
  if (this.hasOwnProperty(instanceName)) {
    error("instantiateTypeName: instance '" + instanceName + "' already exists");
    return null;
  }
  if (!spirit.core.type.hasOwnProperty(typeName)) {
    error("instantiateTypeName: type '" + typeName + "' is not defined");
    return null;
  }

  let type = spirit.core.type[typeName];
  if (type.abstract) {
    error("instantiateTypeName: type '" + typeName + "' is abstract");
    return null;
  }

  let instance = this.value[instanceName] = {
    type: typeName,
  }

  // copy all properties from parenttype to name
  if (!isTypeEnheritedFrom(typeName,"object")){
    instance.value = type.value;
  } else {
    instance.value = JSON.parse(JSON.stringify(type.value));
  }

  return instance;
}

 // ******************************************************************
 // stuff for tree-walker, parocessing scan....

let createRequestScannerObject = spirit.core.util.createRequestScannerObject = function(){
  let requestScannerObject = new Object({
    mustSave: false,
    pathStack:[],
    objectStack:[],
  });

  return requestScannerObject;
}

let scanReqestObject = spirit.core.call.scanRequestObject = function(requestObject,requestScannerObject = null){

}

let transformJSON = spirit.core.util.transformJSON = function(jsonInput){
  let input = null;

  // try and catch any in an attempt to parse the jsonInput argument

  try {
    input = JSON.parse(jsonInput);
    if (!(typeof input === 'object')) {
      return JSON.stringify(error('the argument to transformJSON(' + jsonInput + ') is not an object.'));
    }

    if (!input.hasOwnProperty('value')){
      return JSON.stringify(spirit);
    }
  } catch(err) {
    return JSON.stringify(error('JSON.parse(jsonInput) failed.'));
  }
  
  return '{}';
}

 // ******************************************************************
 // functions that can only run in the node environment

if (spirit.core.const.IS_NODE == true) {
  // give the node environment a specific space in the kernel

  const fs = require('fs');
  const path = require('path');
  const ROOT_DIR = process.cwd();
  const DEFAULT_SPIRIT_PORT = 65432;
  
  spirit.core.node = {
    module:{
      fs:fs,
      path:path,
    },
    const:{
      ROOT_DIR:ROOT_DIR,
      DEFAULT_SPIRIT_PORT:DEFAULT_SPIRIT_PORT,
    },
    util:{

    },
  };

  let fsPath = spirit.core.node.util.fsPath =
  function(baseDir, requestPath) {
    const safePath = path.normalize(requestPath).replace(/^\/+/, '');
    const joined = path.join(baseDir, safePath);
    const relative = path.relative(baseDir, joined);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    return joined;
  };

  let loadFile = spirit.core.fs.loadFile = 
  function(filePath){

    filePath = fsPath(ROOT_DIR,filePath);
    //print('in IS_NODE loadFile(); ' + process.cwd());
  
    try {
      return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    } catch (err) {
      return null;
    }
  };

  module.exports = spirit;
}

 // ******************************************************************
 // functions that can only run in the browser environment

 if (spirit.core.const.IS_BROWSER == true) {
  spirit.core.fs.loadFile = function(filePath){
    let result = null;
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.send();
    if (xmlhttp.status==200) {
      result = xmlhttp.responseText;
    }
    return result;
  };

  
  window.spirit = spirit;
}

 // ******************************************************************
 // functions that depend on environment specific other functions

spirit.core.util.loadSpiritModule = function(filePath){
  print('loading spirit module ' + filePath);
  let script = spirit.core.fs.loadFile(filePath);
  if (script==null) return;
  let foo = new Function("spirit",script);
  foo(spirit);
};

spirit.core.util.loadSpiritModule('./js/constants/icons.js');
spirit.core.util.loadSpiritModule('./js/constants/mimetypes.js');
spirit.core.util.loadSpiritModule('./js/fs.js');

} // ******************************************************************
