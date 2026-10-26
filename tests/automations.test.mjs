import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessageCommand } from '../src/approval-commands.mjs';
import { assignWeek, checkSequence, mondayOf, weekSlots } from '../src/editorial-planner.mjs';
import { auditArticleHtml, sameSite, sitemapHealth } from '../src/site-audit.mjs';
import { slugify, slugProblems } from '../src/article-quality.mjs';

test('sending requires an exact approval; questions and edits are not approval',()=>{
 assert.equal(parseMessageCommand('envialo').action,'send');
 assert.equal(parseMessageCommand('sí, envíalo').action,'send');
 assert.equal(parseMessageCommand('lo puedo enviar?').action,'adjust');
 assert.equal(parseMessageCommand('todavia no enviar').action,'adjust');
 assert.equal(parseMessageCommand('no lo envies').action,'close');
});
test('draft and edit instructions remain distinct',()=>{
 assert.deepEqual(parseMessageCommand('borrador: Confirmamos la solicitud de ejemplo'),{action:'draft',text:'Confirmamos la solicitud de ejemplo'});
 assert.deepEqual(parseMessageCommand('hazlo mas corto'),{action:'adjust',instruction:'hazlo mas corto'});
});
test('weekly schedule contains nine slots and validates publication sequence',()=>{
 const slots=weekSlots({baseHour:'09:00',premiumHour:'17:00'});
 assert.equal(slots.length,9);
 const result=assignWeek({weekStart:'2030-01-07',baseHour:'09:00',premiumHour:'17:00',pieces:[],now:Date.parse('2030-01-01T00:00:00Z')});
 assert.equal(result.gaps.length,9);
 assert.deepEqual(checkSequence(result.gaps),[]);
});
test('planner keeps input unchanged and surfaces missing content',()=>{
 const pieces=[{id:'synthetic-carousel',kind:'C',at:''}];const before=JSON.stringify(pieces);
 const plan=assignWeek({weekStart:'2030-01-07',baseHour:'09:00',premiumHour:'17:00',pieces,now:Date.parse('2030-01-01T00:00:00Z')});
 assert.equal(JSON.stringify(pieces),before);
 assert.equal(plan.moves.length,1);assert.equal(plan.gaps.length,8);
 assert.equal(mondayOf('2030-01-09'),'2030-01-07');
});
test('invalid adjacent carousel sequence is reported',()=>{
 assert.ok(checkSequence([{kind:'C',at:'2030-01-07T09:00:00Z'},{kind:'C',at:'2030-01-08T09:00:00Z'}]).length);
});
test('site comparison distinguishes another host',()=>{
 assert.ok(sameSite('https://www.example.com/a','https://example.com/b'));
 assert.ok(!sameSite('https://example.com/a','https://example.org/b'));
});
test('HTML audit detects an incorrect canonical without making a network request',()=>{
 const html='<html><head><title>Example article title for a public demo</title><link rel="canonical" href="https://example.org/other"></head><body><h1>Example</h1><p>Short synthetic content.</p></body></html>';
 const audit=auditArticleHtml(html,'https://example.com/article');
 assert.ok(audit.issues.some(x=>x.id==='canonical_other_site'));
 assert.ok(audit.issues.some(x=>x.id==='thin_content'));
});
test('sitemap audit reports broken responses',()=>{
 const urls=['https://example.com/article'];const report=sitemapHealth(urls,new Map([[urls[0],404]]));
 assert.ok(JSON.stringify(report).includes('404'));
});
test('article slugs are normalized consistently',()=>{
 assert.equal(slugify('Árbol y calidad del agua'),'arbol-y-calidad-del-agua');
 assert.ok(Array.isArray(slugProblems('example-article')));
});
