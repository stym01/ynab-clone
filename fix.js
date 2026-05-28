const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/hover:bg-white dark:bg-slate-900\//g, 'hover:bg-white/');
    content = content.replace(/hover:text-slate-400 dark:text-slate-500\//g, 'hover:text-slate-400/');
    
    // Check for other hover issues
    // For example, if 'bg-slate-50' was replaced inside 'hover:bg-slate-50'
    // My script had specific replacements for 'hover:bg-slate-50' to run first... wait, objects don't guarantee order!
    // Ah, Object.entries(replacements) does not guarantee order if keys are similar.

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
    }
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

processDir(path.join(__dirname, 'src', 'components'));
processDir(path.join(__dirname, 'src', 'app'));

console.log('Done fixing!');
