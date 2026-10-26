import { parseMessageCommand } from '../src/approval-commands.mjs';
import { assignWeek } from '../src/editorial-planner.mjs';
import { auditArticleHtml } from '../src/site-audit.mjs';
import { slugify } from '../src/article-quality.mjs';

const plan=assignWeek({
 weekStart:'2030-01-07',baseHour:'09:00',premiumHour:'17:00',now:Date.parse('2030-01-01T00:00:00Z'),
 pieces:[{id:'synthetic-carousel',kind:'C',at:''},{id:'synthetic-video',kind:'N',n:1,at:''}],
});
const html='<html><head><title>Example content quality review</title></head><body><h1>Example article</h1><p>Synthetic content for an offline demonstration.</p></body></html>';
console.log(JSON.stringify({
 mode:'offline-dry-run',
 approval:{question:parseMessageCommand('lo puedo enviar?'),explicitApproval:parseMessageCommand('envialo')},
 planning:{moves:plan.moves,gaps:plan.gaps.length,surplus:plan.surplus.length},
 content:{slug:slugify('Calidad del agua: guía de ejemplo'),issues:auditArticleHtml(html,'https://example.com/article').issues.map(x=>x.id)},
 externalRequests:0,sentMessages:0,publishedPosts:0,
},null,2));
