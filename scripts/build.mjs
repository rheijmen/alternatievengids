// npm run build  (SCAN_DIR=../sovereignos npm run build  to build from a local checkout of the scan)
import { build } from './lib/site.mjs';

const { pages, ctx, outDir } = await build();
const s = ctx.model.stats;
console.log(`Gebouwd: ${pages.length} pagina's in ${outDir}`);
console.log(`Bron: ${ctx.scan.source} (scan ${ctx.scan.release.version}, lijst van ${ctx.model.generated})`);
console.log(`Producten ${s.products} (beoordeeld ${s.rated}, niet beoordeeld ${s.unrated}), alternatief-voor-pagina's ${ctx.model.targets.filter(t => t.products.length).length}`);
const skipped = ctx.model.excluded.reduce((a, e) => ((a[e.why] = (a[e.why] || 0) + 1), a), {});
console.log('Niet gepubliceerd:', JSON.stringify(skipped));
