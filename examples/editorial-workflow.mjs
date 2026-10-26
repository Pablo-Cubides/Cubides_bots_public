import assert from 'node:assert/strict';
import { parseMessageCommand } from '../src/approval-commands.mjs';
import { assignWeek } from '../src/editorial-planner.mjs';
import { checkDraftSeo } from '../src/article-quality.mjs';

// Synthetic inputs only. The source draft is intentionally self-contained.
const draft={
 title:'Calidad del agua: revisión editorial',
 slug:'calidad-del-agua',
 keyword:'calidad agua',
 metaDescription:'Una guía de revisión editorial para explicar qué datos de calidad del agua se necesitan, cómo interpretarlos y qué limitaciones deben comunicarse.',
 body:`La calidad del agua se interpreta con datos y contexto. Esta pieza sintética explica el proceso editorial: revisar el alcance, comprobar las fuentes y comunicar las limitaciones antes de proponer una publicación.

## Fuentes del ejemplo
Las referencias de esta demostración son dominios reservados: [fuente A](https://example.org/source-a) y [fuente B](https://example.net/source-b).

## Preguntas frecuentes
### ¿Qué información se necesita?
Se necesita identificar el origen de los datos, el alcance de la revisión y las limitaciones que deben explicarse a cualquier lector.
### ¿Se consulta un servicio externo?
Esta demostración procesa únicamente texto sintético en memoria y no realiza conexiones a servicios externos ni modifica información de una cuenta.
### ¿El resultado publica contenido?
El resultado propone acciones para revisión manual; una integración real necesitaría verificar identidad, permisos y la acción concreta antes de ejecutarla.`,
};

function review(command,article){
 const approval=parseMessageCommand(command);
 const findings=checkDraftSeo(article);
 const blockers=findings.filter(x=>x.severity==='error').map(x=>x.id);
 const decision=blockers.length?'blocked-by-quality':approval.action==='send'?'ready-for-scheduling-dry-run':'awaiting-explicit-approval';
 return {command,approval:approval.action,blockers,decision};
}
const scenarios=[
 review('lo puedo enviar?',draft),
 review('envialo',{...draft,body:'Short synthetic draft without the required FAQ section.'}),
 review('envialo',draft),
];
assert.equal(scenarios[0].decision,'awaiting-explicit-approval');
assert.equal(scenarios[1].decision,'blocked-by-quality');
assert.ok(scenarios[1].blockers.includes('faq_faltante'));
assert.equal(scenarios[2].decision,'ready-for-scheduling-dry-run');

const plan=assignWeek({
 weekStart:'2030-01-07',baseHour:'09:00',premiumHour:'17:00',now:Date.parse('2030-01-01T00:00:00Z'),
 pieces:[{id:'synthetic-article',kind:'C',at:''},{id:'synthetic-video',kind:'N',n:1,at:''}],
});
assert.equal(plan.moves.length,2);
assert.equal(plan.gaps.length,7);
console.log(JSON.stringify({
 mode:'offline-editorial-workflow',
 scenarios,
 proposedMoves:plan.moves,
 remainingSlots:plan.gaps.length,
 externalRequests:0,sentMessages:0,publishedPosts:0,
},null,2));
