import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

function isEmpty(value) {
    return (value === undefined || value === null || value === '');
}

function dir(urlFile) {
    return dirname(fileURLToPath(urlFile));
}

function dirJoin(urlFile, joinPath) {
    return join(dir(urlFile), joinPath);
}

export {
    isEmpty,
    dir,
    dirJoin
};
