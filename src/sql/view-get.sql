select sch.nspname::text as schema,
       cl.relname::text as name,
       pg_catalog.pg_get_viewdef(cl.oid, true) as body,
       d.description
  from pg_catalog.pg_class cl
       join pg_catalog.pg_namespace sch on sch.oid = cl.relnamespace
       left join pg_catalog.pg_description d on (d.objoid = cl.oid and d.objsubid = 0)
 where sch.nspname = $1
   and cl.relname = $2
   and cl.relkind = 'v'::char