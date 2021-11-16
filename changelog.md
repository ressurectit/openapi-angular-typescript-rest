# Changelog

## Version 1.2.0 (2021-11-16)

### Features

- update template for generating api (model imports and eslint ignore)
- removing unused imports
- support of param transform
- support of `QueryObject` and `Body` for new parameters
- support of merging `Query` params into `QueryObject` param

## Version 1.1.0 (2021-11-16)

### Bug Fixes

- removed forgotten decorator `@test`

### Features

- support of additional imports
- support of apiPathReplacement global
- support of apiPathReplacement class specific
- support of adding new parameters to methods

## Version 1.0.0 (2021-11-15)

### Features

- openapi `typescript-angular` generator custom templates for `@anglr/rest`
- removal of `Using<HTTP_METHOD>` suffix for methods
- replacement of *path* for methods with *path arguments*
- working `ResponseTransform` adding
