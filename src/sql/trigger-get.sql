select t.tgname as name,
       c.relname as tablename,
       cn.nspname  as schema,
       t.tgnargs as num_args,
       string_to_array(encode(t.tgargs, 'escape'),'\000') as args,
       p.proname as function_name,
       pn.nspname as function_schema,
       ds.description,
       pg_get_triggerdef(t.oid, true) as def,
       case when (t.tgtype::int::bit(7) & b'0000001')::int = 0 then 'statement' else 'row' end as act_scope,
       coalesce(
               case when (t.tgtype::int::bit(7) & b'0000010')::int = 0 then null else 'before' end,
               case when (t.tgtype::int::bit(7) & b'0000010')::int = 0 then 'after' else null end,
               case when (t.tgtype::int::bit(7) & b'1000000')::int = 0 then null else 'instead of' end,
               '')::text as act_timing,
       case when (t.tgtype::int::bit(7) & b'0000100')::int = 0 then false else true end as on_insert,
       case when (t.tgtype::int::bit(7) & b'0001000')::int = 0 then false else true end as on_delete,
       case when (t.tgtype::int::bit(7) & b'0010000')::int = 0 then false else true end as on_update,
       case when (t.tgtype::int::bit(7) & b'0100000')::int = 0 then false else true end as on_truncate,
       case when coalesce(t.tgconstraint,0) = 0 then 'n' else
           case when not t.tgdeferrable then 'y' else
               case when not t.tginitdeferred then 'ydi' else 'ydd' end
               end
           end as constr
from pg_catalog.pg_trigger t
         join pg_catalog.pg_proc p
         join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
              on t.tgfoid = p.oid
         join pg_catalog.pg_class c
         join pg_catalog.pg_namespace cn on cn.oid = c.relnamespace
              on t.tgrelid = c.oid
         left join pg_catalog.pg_description ds on ds.objoid = t.oid
where t.tgisinternal = 'f'
  and c.relname = $3
  and cn.nspname = $1
  and t.tgname = $2