const [major,minor]=process.versions.node.split('.').map(Number);if(major<24||(major===24&&minor<17)){console.error('Instalá Node.js 24.17 o posterior desde https://nodejs.org/');process.exitCode=1;}
