ALTER TABLE tiemailcorporativo ADD COLUMN IF NOT EXISTS idusuario INTEGER REFERENCES usuarios(idusuario);
