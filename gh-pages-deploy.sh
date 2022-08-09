#!/bin/sh
cd client
npm i
npx next build
npx next export
npx gh-pages -d out