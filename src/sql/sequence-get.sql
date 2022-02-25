select pn.nspname as schema,
       p.relname as name,
       ps.seqstart as start,
       ps.seqmin as minvalue,
       ps.seqmax as maxvalue,
       ps.seqincrement as increment,
       ps.seqcycle as cycle,
       ps.seqcache as cache
  from pg_catalog.pg_class p
       join pg_catalog.pg_namespace pn on pn.oid = p.relnamespace
       join pg_catalog.pg_sequence ps on ps.seqrelid = p.oid
 where p.relkind = 'S'
   and p.relname = $2
   and pn.nspname = $1