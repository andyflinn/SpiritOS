// the kernel
// this file 

'use strict';


// constants
const SPIRIT_NAME = 'SpiritOS';

function print(str){
  console.log(str);
}
function error(str){
  console.error('ERROR: ' + str);
}

function isName(str) {
  if (str == null) return false;
  if (str == undefined) return false;
  return /^[a-z]+$/.test(str);
}

/*
// constraints on the name of object names
const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy";
function numberToBase26(n) {
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
function base26ToNumber(str) {
  if (!isName(str)) return null;

  let num = 0;
  for (let char of str) {
    const digit = BASE26_DIGITS.indexOf(char);
    if (digit === -1) return null;
    num = num * 26 + digit;
  }
  return num;
}
*/

// 
const spirit = {
  name: SPIRIT_NAME,
  type: SPIRIT_NAME,
  core: {
    nostore: true,
    info: {
      nostore: true,
    },
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {
      isName: isName,
//      numberToBase26: numberToBase26,
//      base26ToNumber: base26ToNumber,
    },
    call: {

    },
    type:{},
  },
  value:{},
};

let isType = spirit.core.util.isType = function(typename){
  if (!isName(typename)) return false;
  if (!spirit.core.type.hasOwnProperty(typename)) return false;
  return true;
}

/*
let ancestorArray = spirit.core.util.ancestorArray = function(typename){
  if (!isType(typename)) return null;

  let ancestors = [];

  while (   isName(typename)
        &&  typename != "type"
        &&  spirit.core.type.hasOwnProperty(typename)
        ){
          let type = spirit.core.type[typename];
          ancestors.push(typename);
        
          typename = spirit.core.type[typename].parenttype;
    }
      
  return ancestors;
}
*/

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
let immutable = createType("immutable","flag");
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
  table.value = [];
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


let tupletypename = createType("tupletypename","object");{
  defineTypeMember.call(tupletypename,"name","typename");
  defineTypeMember.call(tupletypename,"name","membername");
}

let tuple = createType("tuple","tupletypename");

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

