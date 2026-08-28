// the kernel
// this file 

'use strict';

const AUTHOR = 'Andy Flinn, from AndyFlinn.com';
const COPYRIGHT = 'Copyright (c) 2024 Andy Flinn, from AndyFlinn.com';
const VERSION = '0.0.1';

// constants
const DEBUG = true;
const SPIRIT_NAME = 'SpiritOS';

// 
const spirit = {
  name: SPIRIT_NAME,
  type: SPIRIT_NAME,
  core: {
    nostore: true,
    info: {
      debug: DEBUG,
    },
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {
    },
    call: {

    },
    type:{},
  },
  value:{},
};



let print = spirit.core.util.print = function(str){
  console.log(str);
}

let error = spirit.core.util.error = function(str){
  console.error('ERROR: ' + str);
}

let isName = spirit.core.util.isName = function(str) {
  if (str == null) return false;
  if (str == undefined) return false;
  return /^[a-z]+$/.test(str);
}

/**
 * Convert a non‑negative integer to a bijective base‑26 string.
 *
 *   0 → "z"
 *   1 → "a"
 *   2 → "b"
 *   …
 *   26 → "aa"
 *
 * Returns `null` for negative numbers or non‑numeric arguments.
 */

const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxyz";
const powersOf26 = [0,26,26**2,26**3,26**4,26**5,26**6,26**7,26**8,26**9,26**10,26**11];

let numberToBase26 = spirit.core.util.numberToBase26 = function(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null;
  if (n === 0) return 'z';

  let active = false;
  let result = '';
  let num = n;
  let remainder = 0;
  let index = 0;
  for (let i = powersOf26.length - 1; i >= 0; i--) {
    if (!active && num < powersOf26[i]) {
      continue;
    }
    else {
      active = true;
    }

    if (i > 0) {
      remainder = num % powersOf26[i];
      index = (num - remainder) / powersOf26[i];
    }else{ 
      remainder = num;
      index = remainder;
    }
  
    result += BASE26_DIGITS[index];
    num = remainder;
  }

  return result;
}

/**
 * Convert a bijective base‑26 string back to a non‑negative integer.
 *
 *   "z"   → 0
 *   "a"   → 1
 *   "b"   → 2
 *   …
 *   "aa"  → 26
 *
 * Returns `null` if the string is not a valid name or contains an illegal digit.
 */
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



/*
// Base-26 helpers (z=0, a=1, ..., y=25)
const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxyz";
let numberToBase26 = spirit.core.util.numberToBase26 = function(n) {
  if (n < 0) return null;
  if (n === 0) return "z";

  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = BASE26_DIGITS[remainder + 1] + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

let base26ToNumber = spirit.core.util.base26ToNumber = function(str) {
  if (!/^[a-z]+$/.test(str)) return null;

  let num = 0;
  for (let char of str) {
    const digit = BASE26_DIGITS.indexOf(char);
    if (digit === -1) return null;
    num = num * 26 + digit;
  }
  return num;
}
*/

let isType = spirit.core.util.isType = function(typename){
  if (!isName(typename)) return false;
  if (!spirit.core.type.hasOwnProperty(typename)) return false;
  return true;
}

let createType = spirit.core.util.createType = function(name,parenttype){

  print("createType(" + name + "," + parenttype + ")");

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
  //newtype.ancestorArray = ancestorArray(name);


  if (parenttype == "type") return newtype;
    
    // copy all properties from parenttype to name
    for (const key in ptyp){
      if (key == "name" || key == "parenttype"  || key == "abstract" ) continue;
      if (typeof ptyp[key] === 'function') continue; 
      print("copying " + key + " from " + ptyp.name + " to " + name);
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
let array = createType("array","flag");
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
    if (value < number.min || value > number.max) return false;
    return true;
  };
}

let integer = createType("integer","number");{
  integer.min = Number.MIN_SAFE_INTEGER;
  integer.max = Number.MAX_SAFE_INTEGER;
  integer.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (Math.round(value) !== value) return false;
    if (value < integer.min || value > integer.max) return false;
    return true;
  };
}

let counter = createType("counter","integer");{
  counter.min = 0;
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

let defineTypeMember = spirit.core.call.defineTypeMember = function(typeName,memberName){
  if (!isName(memberName)) {
    return null;
  }
  
  if (!isTypeEnheritedFrom(this.name,"object")) {
    print("Type " + typeName + " does not inherit from object");
    return null;
  }

  if (this.members.hasOwnProperty(memberName)) return null;

  let type = spirit.core.type[typeName];
  let parenttype = spirit.core.type[this.parenttype];
  
  this.members[memberName] = typeName;
  
  let member = this.value[memberName] = {
  //  name: memberName,
    type: typeName,
  };

  if (!isTypeEnheritedFrom(typeName,"object")){
    this.value[memberName].value = spirit.core.type[typeName].value;
  } else {
    this.value[memberName].value = JSON.parse(JSON.stringify(spirit.core.type[typeName].value));
  }

  return member;
}

let table = createType("table","object");{
  table.abstract = true;
  table.value = {};
}

let instantiateTableType = spirit.core.call.instantiateTableType = function(name,memberType){
  if (!isName(name)){
    error("instantiateTableType: name '" + name + "' is not a valid name");
    return null;
  }

  if (!isType(memberType)){
    error("instantiateTableType: memberType '" + memberType + "' is not a valid type");
    return null;
  }

  let mType = spirit.core.type[memberType];
  
  if (mType.abstract) {
    error("instantiateTableType: memberType '" + memberType + "' is abstract");
    return null;
  }

  print('instantiateTableType(' + name + ',' + memberType + ')');
  
  if (this == null) {
    error("instantiateTableType: 'this' is null");
    return null;
  }

  if (this == undefined) {
    error("instantiateTableType: 'this' is undefined");
    return null;
  }

  if (typeof this !== 'object') {
    error("instantiateTableType: 'this' is not an object");
    return null;
  }  

  if (!this.hasOwnProperty('type')) {
    error("instantiateTableType: 'this' has no 'type' property");
    return null;
  }
  if (!this.hasOwnProperty('value')) {
    error("instantiateTableType: 'this' has no 'value' property");
    return null;
  }

  let instance = this.value[name] = {
    type: "table",
    membertype: memberType,
    array: true,
    value: [],
  }

  return instance;
}

let create = createType("create","object");{
  defineTypeMember.call(create,"name","typename");
  defineTypeMember.call(create,"name","membername");
}

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

module.exports = spirit;

