import { useState } from 'react';
import { App, Button, Divider, Select } from 'antd';
import type { SelectProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ApiError } from '@/api/types';

interface Opcion {
  value: string;
  label: string;
}

interface Props extends Omit<SelectProps<string>, 'options' | 'onChange' | 'showSearch' | 'popupRender'> {
  options: Opcion[];
  onChange?: (value: string | undefined) => void;
  /** Texto del botón cuando no hay nada escrito, ej. "Nueva marca". */
  textoNuevo: string;
  /** Sin permiso para crear, se comporta como un Select común (sin botón). */
  puedeCrear?: boolean;
  /** Alta rápida solo con el nombre escrito en el buscador. Devuelve el id creado, que queda seleccionado. */
  crear?: (nombre: string) => Promise<string>;
  /** Alta que necesita más datos (abre un modal propio). Recibe lo escrito para pre-rellenar. */
  onNuevo?: (texto: string) => void;
}

/** Select con buscador y un botón "+ Agregar" al pie, para crear la opción que falta (marca,
 * categoría, unidad, proveedor...) sin salir del formulario ni refrescar la página. Si lo escrito
 * no existe y hay `crear`, se crea con ese nombre en un clic y queda seleccionado. */
export function SelectConCrear({ options, onChange, textoNuevo, puedeCrear = true, crear, onNuevo, ...resto }: Props) {
  const { message } = App.useApp();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);

  const texto = busqueda.trim();
  const existe = options.some((o) => o.label.toLocaleUpperCase('es-PE') === texto.toLocaleUpperCase('es-PE'));
  const crearConNombre = !!crear && !!texto && !existe;

  const agregar = async () => {
    if (!crearConNombre) {
      onNuevo?.(texto);
      return;
    }
    setCreando(true);
    try {
      const id = await crear!(texto);
      onChange?.(id);
      setBusqueda('');
      message.success(`"${texto.toLocaleUpperCase('es-PE')}" agregado`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo agregar');
    } finally {
      setCreando(false);
    }
  };

  const mostrarBoton = puedeCrear && (crearConNombre || !!onNuevo);

  return (
    <Select<string>
      {...resto}
      options={options}
      onChange={(v) => onChange?.(v)}
      showSearch={{
        searchValue: busqueda,
        onSearch: setBusqueda,
        filterOption: (input, opcion) => String(opcion?.label ?? '').toLocaleUpperCase('es-PE').includes(input.toLocaleUpperCase('es-PE')),
      }}
      popupRender={(menu) => (
        <>
          {menu}
          {mostrarBoton && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <Button
                type="link" block icon={<PlusOutlined />} loading={creando}
                style={{ textAlign: 'left' }}
                // Evita que el clic cierre el desplegable o le quite el foco al buscador antes de crear.
                onMouseDown={(e) => e.preventDefault()}
                onClick={agregar}
              >
                {crearConNombre ? `Agregar "${texto.toLocaleUpperCase('es-PE')}"` : textoNuevo}
              </Button>
            </>
          )}
        </>
      )}
    />
  );
}
