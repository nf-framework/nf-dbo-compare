select cols.*,
       (select array_agg((select cls.attname::text
          from pg_catalog.pg_attribute cls,
               pg_catalog.pg_type      tps
         where cls.attrelid     = cons.conrelid
           and cls.attnum       = any(cons.conkey)
           and not cls.attisdropped
           and cls.attnum       > 0
           and tps.oid          = cls.atttypid
           and tps.typcategory  = 'S'
         order by cls.attnum
         limit 1))
      from pg_catalog.pg_constraint  cons
     where cons.conrelid     = ft.oid
       and cons.contype      = 'u') unique_cols
  from (select t.t->>'columns' as columns,
               t.t->>'r_schema' as r_schema,
               t.t->>'r_tablename' as r_tablename,
               t.t->>'r_columnname' as r_columnname
          from  unnest($1::json[]) as t) cols
       left join pg_catalog.pg_class ft
                 join pg_catalog.pg_namespace sch on sch.oid = ft.relnamespace
              on (ft.relname = cols.r_tablename and sch.nspname = cols.r_schema)