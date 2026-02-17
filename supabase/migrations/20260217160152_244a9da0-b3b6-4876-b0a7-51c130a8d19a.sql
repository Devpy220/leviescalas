
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(
        TRIM(
          COALESCE(NEW.raw_user_meta_data ->> 'first_name', '') || ' ' || 
          COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
        ), 
        ''
      ),
      ''
    ),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', '')
  );
  RETURN NEW;
END;
$function$;
