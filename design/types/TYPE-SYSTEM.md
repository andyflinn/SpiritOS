# SpiritOS Type System

**Version:** 0.1 (17 May 2026)  
**Author:** Andy Flinn

## Core Principle: Freedom First

The lowest layer of SpiritOS is **intentionally untyped**.  
Users can create arbitrary objects and freely add/remove members using valid `a-z` keys **without any typing**.

Typing is **opt-in**. It provides optional structure, protection, validation, and special behavior (transforms/methods).

## Global Static Type Registry

All types live under `system.types`. Core types are protected. User/plugin types can be freely added and removed.

## Primitive Types

```json
{ "_type": "boolean", "value": true }
{ "_type": "integer", "value": 47 }
{ "_type": "float",   "value": 3.14159 }
{ "_type": "string",  "value": "portrait photo of me in the swimming pool in buchs, ca 1976" }
{ "_type": "name",    "value": "andyflinn" }     // inherits from string, a-z only