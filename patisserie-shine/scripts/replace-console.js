// scripts/replace-console.js
// Script pour remplacer tous les console.log par logger

const fs = require('fs');
const path = require('path');

// Dossiers à traiter
const directories = [
  'src/app',
  'src/components',
  'src/lib',
  'src/services'
];

// Fonction pour remplacer dans un fichier
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Patterns à remplacer
  const replacements = [
    {
      // console.log(...) → logger.log(...)
      pattern: /console\.log\(/g,
      replacement: 'logger.log(',
      
    },
    {
      // console.error(...) → logger.error(...)
      pattern: /console\.error\(/g,
      replacement: 'logger.error(',
    },
    {
      // console.warn(...) → logger.warn(...)
      pattern: /console\.warn\(/g,
      replacement: 'logger.warn(',
    }
  ];

  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  // Ajouter l'import si modifié et pas déjà présent
  if (modified && !content.includes("import { logger }") && !content.includes("import logger")) {
    // Ajouter l'import en haut du fichier
    const importStatement = "import { logger } from '@/lib/logger';\n";
    
    // Si le fichier commence par 'use client' ou 'use server'
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
      content = content.replace(/(['"])use client\1;?\n/, `$&\n${importStatement}`);
    } else {
      content = importStatement + content;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Modifié: ${filePath}`);
    return true;
  }
  return false;
}

// Fonction pour parcourir les dossiers
function processDirectory(dir) {
  let count = 0;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      count += processDirectory(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      if (replaceInFile(filePath)) {
        count++;
      }
    }
  });
  
  return count;
}

// Exécution
console.log('🔍 Recherche et remplacement des console.log...\n');

let totalModified = 0;

directories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`📁 Traitement de ${dir}...`);
    totalModified += processDirectory(fullPath);
  }
});

console.log(`\n✨ Terminé! ${totalModified} fichiers modifiés.`);
console.log('\n⚠️  Vérifiez les modifications et testez votre application!');
