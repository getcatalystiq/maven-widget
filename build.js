const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Function to read build-time values (CSS and version)
function getBuildDefines() {
  const css = fs.readFileSync(path.join(__dirname, 'src/styles/widget.css'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const version = packageJson.version;

  return {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    '__WIDGET_CSS__': JSON.stringify(css),
    '__WIDGET_VERSION__': JSON.stringify(version),
  };
}

// Build configuration
function getBuildConfig() {
  return {
    entryPoints: ['src/index.tsx'],
    bundle: true,
    minify: !isWatch,
    sourcemap: isWatch,
    target: ['es2020'],
    format: 'iife',
    outfile: 'dist/widget.js',
    define: getBuildDefines(),
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
    },
    logLevel: 'info',
    metafile: true, // Generate metafile for bundle analysis
    // Dedupe React - ensure all packages use widget's React copy
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  };
}

async function build() {
  try {
    if (isWatch) {
      let ctx = await esbuild.context(getBuildConfig());
      await ctx.watch();
      console.log('Watching for changes...');

      // Track current version to detect actual changes
      let currentVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
      let packageJsonTimeout = null;

      // Only watch package.json for version updates
      // (esbuild's built-in watch handles CSS and source files)
      fs.watch('package.json', async (eventType) => {
        if (eventType === 'change') {
          // Debounce: clear existing timeout and set new one
          if (packageJsonTimeout) clearTimeout(packageJsonTimeout);

          packageJsonTimeout = setTimeout(async () => {
            // Read the new version
            const newVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

            // Only rebuild if version actually changed
            if (newVersion !== currentVersion) {
              console.log(`📦 Version changed: ${currentVersion} → ${newVersion}`);
              currentVersion = newVersion;

              try {
                // Dispose old context
                await ctx.dispose();

                // Create new context with fresh config (reads new version)
                ctx = await esbuild.context(getBuildConfig());

                // Start watching again (this will automatically trigger one build)
                await ctx.watch();

                console.log('✅ Rebuild complete with new version');
              } catch (error) {
                console.error('❌ Error recreating context:', error);
              }
            }
          }, 300); // Wait 300ms for file system to settle
        }
      });

      console.log('👀 Also watching package.json for version changes');

      // Watch src/ directory for CSS and other non-imported file changes
      let srcWatchTimeout = null;
      const srcWatcher = fs.watch('src', { recursive: true }, async (_eventType, filename) => {
        // Accept both 'change' and 'rename' events (macOS can emit either)
        if (filename) {
          // Filter out irrelevant files
          if (filename.includes('.DS_Store') || filename.includes('.swp') || filename.includes('~')) {
            return;
          }

          // Only rebuild for CSS files (other files are handled by esbuild's watcher)
          if (!filename.endsWith('.css')) {
            return;
          }

          // Debounce: clear existing timeout and set new one
          if (srcWatchTimeout) clearTimeout(srcWatchTimeout);

          srcWatchTimeout = setTimeout(async () => {
            console.log(`🔄 CSS file changed (${filename}), rebuilding...`);

            try {
              // Dispose old context
              await ctx.dispose();

              // Create new context with fresh config (re-reads CSS and other files)
              ctx = await esbuild.context(getBuildConfig());

              // Start watching again (this will automatically trigger one build)
              await ctx.watch();

              console.log('✅ Rebuild complete');
            } catch (error) {
              console.error('❌ Error rebuilding:', error);
            }
          }, 200); // Increased to 200ms for file system to settle
        }
      });

      console.log('👀 Also watching src/ for CSS and asset changes');
    } else {
      const result = await esbuild.build(getBuildConfig());
      console.log('Build complete!');

      // Show bundle size
      const stats = fs.statSync('dist/widget.js');
      console.log(`Bundle size: ${(stats.size / 1024).toFixed(2)} KB`);

      // Write metafile for analysis
      if (result.metafile) {
        fs.writeFileSync('dist/metafile.json', JSON.stringify(result.metafile, null, 2));

        // Show top 10 largest modules
        const inputs = result.metafile.inputs;
        const sorted = Object.entries(inputs)
          .map(([path, info]) => ({ path, bytes: info.bytes }))
          .sort((a, b) => b.bytes - a.bytes)
          .slice(0, 10);

        console.log('\nTop 10 largest modules:');
        sorted.forEach(({ path, bytes }) => {
          console.log(`  ${(bytes / 1024).toFixed(1)} KB - ${path}`);
        });
      }
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
