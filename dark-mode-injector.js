const fs = require('fs');
const path = require('path');

const replacements = {
    'bg-white': 'bg-white dark:bg-slate-900',
    'bg-slate-50/50': 'bg-slate-50/50 dark:bg-slate-800/50',
    'bg-slate-50/60': 'bg-slate-50/60 dark:bg-slate-800/60',
    'bg-slate-50/80': 'bg-slate-50/80 dark:bg-slate-800/80',
    'bg-slate-50 ': 'bg-slate-50 dark:bg-slate-800 ',
    'bg-slate-50"': 'bg-slate-50 dark:bg-slate-800"',
    'bg-slate-50`': 'bg-slate-50 dark:bg-slate-800`',
    'bg-slate-100': 'bg-slate-100 dark:bg-slate-800',
    'bg-slate-200': 'bg-slate-200 dark:bg-slate-700',
    'text-slate-800': 'text-slate-800 dark:text-slate-200',
    'text-slate-700': 'text-slate-700 dark:text-slate-300',
    'text-slate-600': 'text-slate-600 dark:text-slate-400',
    'text-slate-500': 'text-slate-500 dark:text-slate-400',
    'text-slate-400': 'text-slate-400 dark:text-slate-500',
    'border-slate-200': 'border-slate-200 dark:border-slate-700',
    'border-slate-100': 'border-slate-100 dark:border-slate-800',
    'border-slate-50': 'border-slate-50 dark:border-slate-800/50',
    'hover:bg-slate-50 ': 'hover:bg-slate-50 dark:hover:bg-slate-800/50 ',
    'hover:bg-slate-50"': 'hover:bg-slate-50 dark:hover:bg-slate-800/50"',
    'hover:bg-slate-50/80': 'hover:bg-slate-50/80 dark:hover:bg-slate-800/80',
    'hover:bg-slate-100': 'hover:bg-slate-100 dark:hover:bg-slate-800',
    'hover:bg-slate-200': 'hover:bg-slate-200 dark:hover:bg-slate-700',
    'hover:text-slate-800': 'hover:text-slate-800 dark:hover:text-slate-200',
    'hover:text-slate-600': 'hover:text-slate-600 dark:hover:text-slate-300',
};

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const [key, value] of Object.entries(replacements)) {
        // Simple string replace for all instances
        // We have to split by key and join by value carefully to avoid double-replacing
        content = content.split(key).join(value);
    }
    
    // Fix any double dark: dark: if the script is run multiple times or overlapping keys
    content = content.replace(/dark:bg-slate-900 dark:bg-slate-900/g, 'dark:bg-slate-900');
    // We assume the script is run once perfectly.

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated', filePath);
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

console.log('Done!');
