---
title: dipole
summary: dipole - tiny reactive state management that just works
authors: Eugene Daragan
---
<a href="https://dipole.js.org">
  <img alt="dipole" src="https://dipole.js.org/assets/dipole-transparent-black.png" style="height: 100px" />
</a>

[![NPM version](https://img.shields.io/npm/v/dipole)](https://www.npmjs.com/package/dipole)
[![Minzipped size](https://img.shields.io/bundlephobia/minzip/dipole?color=green)](https://www.npmjs.com/package/dipole)
[![codecov](https://codecov.io/gh/zheksoon/dipole/branch/master/graph/badge.svg?token=WMVIB287XM)](https://codecov.io/gh/zheksoon/dipole)

**dipole** is tiny (just about 2K min gz) reactive state management library that could be used standalone or with React/Preact. It's heavily inspired by [MobX](https://github.com/mobxjs/mobx) and was initially thought as a pedagogical re-implementation of its core features, and had grown later to a complete library. At this moment dipole can be seen as MobX minus "magic".

**dipole features**:

 * Clean and minimalistic object-oriented implementation of observable/functional reactive paradigm in about 500 lines of code
 * Opaque data structures - you can easily examine dipole internals in debugger, no class fields is mangled
 * Performance optimizations - even with a huge amount of observable/computed values dipole runs as efficiently as possible
 * Good test suit - 100% test coverage for complex use cases

## Installation

```bash
npm install --save dipole
```

## Introduction

Check out the [introduction page](introduction.md)

## Examples

Check out the [Examples page](examples.md)

## Author
Eugene Daragan

## License
MIT
