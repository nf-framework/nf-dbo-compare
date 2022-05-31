select p.proname as name,
       n.nspname as schema,
       ds.description,
       l.lanname as lang,
       p.proisstrict as strict,
       p.prosecdef as secdef,
       case p.provolatile when 'v' then 'volatile' when 's' then 'stable' when 'i' then 'immutable' end as volatile,
       case p.proparallel when 'u' then 'unsafe' when 'r' then 'restricted' when 's' then 'safe' end as parallel,
       (case when p.prorettype is not null then
                 (case when pt.typelem = 0 then pt.typname else ptelem.typname end) else null end) as "resType",
       (case when p.prorettype is not null then
                 (case when pt.typelem = 0 then false else true end) else null end) as "resTypeIsArray",
       p.proretset as retset,
       proargnames as argnames,
       p.proargmodes::text[] as argmodes,
       (select array_agg(jsonb_build_object(
                                 'name', (case when pt.typelem = 0 then pt.typname else ptelem.typname end),
                                 'isArray',(case when pt.typelem = 0 then false else true end)) order by aat.nr)
        from unnest(coalesce(p.proallargtypes,p.proargtypes)) with ordinality aat(elem, nr)
                 join pg_catalog.pg_type pt on pt.oid = aat.elem
                 left join pg_catalog.pg_type ptelem on ptelem.oid = pt.typelem
       ) as argtypes,
       p.pronargdefaults as numagrsdefaults,
       pg_get_expr(p.proargdefaults, 0, true) AS argdefaults,
       p.provariadic as "variadic",
       p.prosrc as body,
       p.procost as cost,
       p.prorows as rows,
       p.proleakproof as leakproof
from pg_catalog.pg_proc p
         left join pg_catalog.pg_description ds on ds.objoid = p.oid
         join pg_catalog.pg_namespace n on p.pronamespace = n.oid
         join pg_catalog.pg_language l on l.oid = p.prolang
         left join pg_catalog.pg_type pt on pt.oid = p.prorettype
         left join pg_catalog.pg_type ptelem on ptelem.oid = pt.typelem
where p.proname = $2
  and n.nspname = $1
