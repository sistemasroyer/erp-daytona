import { useRef, useState } from 'react';
import { App, Modal, Button, Typography, Table, Tag, Alert, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { productosApi } from '@/api/productos';
import { ApiError } from '@/api/types';
import type { FilaResultadoImportacion, ResultadoImportacionProductos } from '@/types/producto';

interface Props {
  open: boolean;
  onClose: () => void;
  onImportado: () => void;
}

function leerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = String(reader.result || '');
      resolve(resultado.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImportarProductosModal({ open, onClose, onImportado }: Props) {
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionProductos | null>(null);

  const cerrar = () => {
    setArchivo(null);
    setResultado(null);
    onClose();
  };

  const descargarPlantilla = async () => {
    try {
      await productosApi.descargarPlantillaImportacion();
    } catch {
      message.error('Error al descargar la plantilla');
    }
  };

  const importar = async () => {
    if (!archivo) return;
    setImportando(true);
    try {
      const base64 = await leerComoBase64(archivo);
      const { data } = await productosApi.importar(base64);
      setResultado(data);
      if (data.creados > 0) {
        message.success(`${data.creados} producto${data.creados !== 1 ? 's' : ''} creado${data.creados !== 1 ? 's' : ''} correctamente`);
        onImportado();
      }
      if (data.errores > 0) {
        message.warning(`${data.errores} fila${data.errores !== 1 ? 's' : ''} con errores — revise el detalle abajo`);
      }
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al importar el archivo');
    } finally {
      setImportando(false);
    }
  };

  const columns: ColumnsType<FilaResultadoImportacion> = [
    { title: 'Fila', dataIndex: 'fila', width: 70 },
    { title: 'Código', dataIndex: 'codigo', width: 140 },
    { title: 'Estado', width: 100, render: (_, r) => r.ok ? <Tag color="success">Creado</Tag> : <Tag color="error">Error</Tag> },
    { title: 'Detalle', dataIndex: 'mensaje' },
  ];

  return (
    <Modal
      title="Importar catálogo de productos"
      open={open}
      onCancel={cerrar}
      footer={[
        <Button key="cerrar" onClick={cerrar}>Cerrar</Button>,
        <Button key="importar" type="primary" icon={<UploadOutlined />} loading={importando} disabled={!archivo} onClick={importar}>
          Importar
        </Button>,
      ]}
      width={760}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          title="Cómo funciona"
          description={
            <>
              1. Descargue la plantilla y complete una fila por producto (respete las columnas y las listas desplegables).<br />
              2. Suba el archivo completado y presione Importar.<br />
              3. Cada fila se procesa de forma independiente: si una falla, las demás igual se crean — el detalle le muestra qué pasó con cada una.
            </>
          }
        />

        <Button icon={<DownloadOutlined />} onClick={descargarPlantilla}>Descargar plantilla Excel</Button>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setArchivo(f); setResultado(null); } }}
          />
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>Seleccionar archivo completado</Button>
          {archivo && <Typography.Text style={{ marginLeft: 12 }}>{archivo.name}</Typography.Text>}
        </div>

        {resultado && (
          <>
            <Alert
              type={resultado.errores > 0 ? 'warning' : 'success'}
              showIcon
              title={`${resultado.creados} de ${resultado.total} fila${resultado.total !== 1 ? 's' : ''} importada${resultado.creados !== 1 ? 's' : ''} correctamente${resultado.errores > 0 ? `, ${resultado.errores} con errores` : ''}`}
            />
            <Table<FilaResultadoImportacion>
              rowKey="fila"
              size="small"
              columns={columns}
              dataSource={resultado.detalle}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 300 }}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
