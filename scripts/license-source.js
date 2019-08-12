const fs = require('fs');
const glob = require('glob');

const HEADER = [
  '/*',
  ' * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501',
  ' */'
];

glob
  .sync('src/**/*.ts')
  .filter(file => !file.match('.spec'))
  .forEach(filePath => {
    let lines = fs
      .readFileSync(filePath)
      .toString()
      .split('\n');

    if (lines[1] !== HEADER[1]) {
      lines = [...HEADER, '', ...lines];
    } else {
      lines = [...HEADER, ...lines.slice(4)];
    }

    fs.writeFileSync(filePath, lines.join('\n'));
  });
