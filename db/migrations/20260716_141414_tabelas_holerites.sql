-- Migration: Tabelas-Holerites
-- Criada em: 2026-07-16T17:14:14.055Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

CREATE TABLE IF NOT EXISTS public.folhaitens
(
    iditem integer NOT NULL DEFAULT nextval('folhaitens_iditem_seq'::regclass),
    idholerite integer NOT NULL,
    tipo character(1) COLLATE pg_catalog."default" NOT NULL,
    descricao character varying(120) COLLATE pg_catalog."default" NOT NULL,
    valor numeric(12,2) DEFAULT 0,
    CONSTRAINT folhaitens_pkey PRIMARY KEY (iditem),
    CONSTRAINT folhaitens_idholerite_fkey FOREIGN KEY (idholerite)
        REFERENCES public.folhaholerite (idholerite) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.folhaitens
    OWNER to postgres;


CREATE TABLE IF NOT EXISTS public.folhaholerite
(
    idholerite integer NOT NULL DEFAULT nextval('folhaholerite_idholerite_seq'::regclass),
    idempresa integer NOT NULL,
    idfuncionario integer NOT NULL,
    mes integer NOT NULL,
    ano integer NOT NULL,
    salariobase numeric(12,2) DEFAULT 0,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'Pendente'::character varying,
    dtpagamento date,
    obs text COLLATE pg_catalog."default",
    criadoem timestamp without time zone DEFAULT now(),
    tipo character varying(20) COLLATE pg_catalog."default",
    CONSTRAINT folhaholerite_pkey PRIMARY KEY (idholerite),
    CONSTRAINT folhaholerite_uniq UNIQUE (idempresa, idfuncionario, mes, ano, tipo)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.folhaholerite
    OWNER to postgres;