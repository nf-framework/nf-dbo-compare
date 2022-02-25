select  sch.nspname as schema,
        tabl.relname as tablename,
        d.description as comment,
        (select array_to_json(array_agg(row_to_json(col)))
          from (select
                      t3.attname as name,
                      t4.typname as datatype,
                      substring(pg_catalog.format_type(t3.atttypid, t3.atttypmod) from '\((.+)\)') datatype_length,
                      pg_catalog.format_type(t3.atttypid, t3.atttypmod) as datatype_full,
                      t3.attnotnull as required,
                      pg_get_expr(d.adbin, t3.attrelid, true) as default_value,
                      ds.description as comment,
                      (select fks.nspname||'.'||fk.relname
                         from pg_catalog.pg_constraint  fk_cns
                              join pg_catalog.pg_class fk on (fk.oid = fk_cns.confrelid)
                              join pg_catalog.pg_namespace fks on (fks.oid = fk.relnamespace)
                        where fk_cns.conrelid = tabl.oid
                          and t3.attnum = any(fk_cns.conkey)
                         limit 1)
                       as fk_tablename,
                      t3.attnum as column_id,
                      t3.attidentity as identity
                 from pg_catalog.pg_attribute   t3
                      left join pg_catalog.pg_attrdef d on d.adrelid = t3.attrelid and d.adnum = t3.attnum
                      left join pg_catalog.pg_description ds on ds.objoid = t3.attrelid and ds.objsubid = t3.attnum
                      join pg_catalog.pg_type t4 on t4.oid = t3.atttypid
                where t3.attrelid = tabl.oid
                  and t3.attnum       > 0
                  and not t3.attisdropped
                order by t3.attnum asc) col) as cols,
       (select array_to_json(array_agg(row_to_json(con)))
          from (select t.conname as name,
                        n.nspname as schema,
                        t.contype as type,
                        nullif(t.confupdtype,' ') as update_rule,
                        nullif(t.confdeltype,' ') as delete_rule,
                        pg_get_expr(t.conbin, t.conrelid) as condition,
                        pg_catalog.pg_get_constraintdef(t.oid, true) definition,
                        fn.nspname as r_schema,
                        f.relname as r_tablename,
                        (select fa.attname
                           from pg_catalog.pg_attribute fa
                          where fa.attrelid = f.oid
                            and fa.attnum = t.confkey[1]) as r_columnname,
                        (select array_to_string(array(
                          select (select a.attname::text
                                    from pg_catalog.pg_attribute a
                                   where a.attrelid = t.conrelid
                                     and a.attnum = g.arr[g.rn])
                            from (select t.conkey as arr, generate_subscripts(t.conkey, 1) as rn) g
                           order by g.rn),',')) as columns,
                        (select array(
                            select jsonb_build_object(
                                'name',(case when t.conkey[g.rn] = 0 then
                                            pg_get_indexdef(ix.indexrelid , g.rn, false)
                                        else
                                            (select a.attname::text
                                              from pg_catalog.pg_attribute a
                                             where a.attrelid = t.conrelid
                                               and a.attnum = t.conkey[g.rn])
                                        end),
                                'op',(select o.oprname from pg_catalog.pg_operator o where o.oid = t.conexclop[g.rn]))
                            from (select generate_subscripts(t.conkey, 1) as rn) g
                            order by g.rn)) as ix_columns,
                        ds.description as comment,
                        case when t.condeferrable then
                            case when t.condeferred then 'deferred' else 'immediate' end
                        else null end as deferrable,
                        am.amname as ix_method,
                        pg_get_expr(ix.indpred, ix.indrelid) as ix_where_expr
                   from pg_catalog.pg_constraint t
                        join pg_catalog.pg_namespace n on n.oid = t.connamespace
                        left join pg_catalog.pg_class f
                                  join pg_catalog.pg_namespace fn on fn.oid = f.relnamespace
                               on f.oid = t.confrelid
                        left join pg_catalog.pg_description ds on ds.objoid = t.oid
                        left join pg_catalog.pg_index ix
                                    join pg_catalog.pg_class c2 on c2.oid = ix.indexrelid
                                    join pg_catalog.pg_am as am on am.oid = c2.relam
                                  on ix.indexrelid = t.conindid
                  where t.conrelid = tabl.oid
                    and t.contype != 't' -- отдельно сам триггер типа ограничение создает
                  order by t.conname) con) as cons,
       (select array_to_json(array_agg(row_to_json(ind)))
         from (select c2.relname as name,
                       n2.nspname as schema,
                       (select array(
                          select jsonb_build_object('name',(case when i.indkey[g.rn] = 0 then pg_get_indexdef(i.indexrelid , g.rn, false) else
                                                            (select a.attname::text as name
                                                              from pg_catalog.pg_attribute a
                                                             where a.attrelid = i.indrelid
                                                               and a.attnum = i.indkey[g.rn]) end),
                                                    'collate',(select ns.nspname||'.'||pg_catalog.quote_ident(coll.collname)
                                                                 from pg_catalog.pg_collation coll
                                                                      join pg_catalog.pg_namespace ns on ns.oid = coll.collnamespace
                                                                where coll.oid = i.indcollation[g.rn]),
                                                    'order', case when i.indoption[g.rn] in (0,2) then 'asc' else 'desc' end,
                                                    'nulls', case when i.indoption[g.rn] in (0,1) then 'last' else 'first' end)
                            from (select generate_subscripts(i.indkey, 1) as rn) g
                           order by g.rn)) as columns,
                       i.indisunique as is_unique,
                       am.amname as method,
                       t2.spcname as tablespace,
                       pg_get_expr(i.indpred, i.indrelid) as where_expr,
                       pg_catalog.pg_get_indexdef(i.indexrelid, 0, true) definition
                  from pg_catalog.pg_index i
                       join pg_catalog.pg_class c2 on (c2.oid = i.indexrelid)
                       join pg_catalog.pg_namespace n2 on (n2.oid = c2.relnamespace)
                       left join pg_catalog.pg_tablespace t2 on (t2.oid = c2.reltablespace)
                       join pg_catalog.pg_am as am on (am.oid = c2.relam)
                 where i.indrelid = tabl.oid
                   and not exists (select null from pg_catalog.pg_constraint con where con.conrelid = i.indrelid and con.conindid = i.indexrelid and contype in ('p','u','x'))
                 order by c2.relname) ind) as indx
  from pg_catalog.pg_class tabl
       join pg_catalog.pg_namespace sch on sch.oid = tabl.relnamespace
       left join pg_catalog.pg_description d on (d.objoid = tabl.oid and d.objsubid = 0)
 where sch.nspname = $1
   and tabl.relname = $2