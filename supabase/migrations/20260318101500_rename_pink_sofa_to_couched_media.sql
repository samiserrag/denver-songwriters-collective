-- Friends directory copy update:
-- Rename "Pink Sofa Hour / Pink Sofa Production Syndicate" entry to "Couched Media".

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'pink-sofa-hour'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.organizations WHERE slug = 'couched-media'
    ) THEN
      UPDATE public.organizations
      SET
        name = 'Couched Media',
        short_blurb = 'Couched Media is the in-house multimedia production arm connected to Pink Sofa Hour and the Pink Sofa Production Syndicate (PSPS), supporting local musicians with recording, storytelling, and promotion.'
      WHERE slug = 'pink-sofa-hour';
    ELSE
      UPDATE public.organizations
      SET
        slug = 'couched-media',
        name = 'Couched Media',
        short_blurb = 'Couched Media is the in-house multimedia production arm connected to Pink Sofa Hour and the Pink Sofa Production Syndicate (PSPS), supporting local musicians with recording, storytelling, and promotion.'
      WHERE slug = 'pink-sofa-hour';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'couched-media'
  ) THEN
    UPDATE public.organizations
    SET
      name = 'Couched Media',
      short_blurb = 'Couched Media is the in-house multimedia production arm connected to Pink Sofa Hour and the Pink Sofa Production Syndicate (PSPS), supporting local musicians with recording, storytelling, and promotion.'
    WHERE slug = 'couched-media';
  END IF;
END $$;
