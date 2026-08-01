import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  App, Modal, Form, Input, InputNumber, Select, Switch, Button, Typography, Divider, Row, Col, Alert, Space,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { productosApi } from '@/api/productos';
import { categoriasApi } from '@/api/categorias';
import { marcasApi } from '@/api/marcas';
import { unidadesMedidaApi } from '@/api/unidades-medida';
import { proveedoresApi } from '@/api/proveedores';
import { configMargenesApi } from '@/api/config-margenes';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { TIPOS_EXISTENCIA, type Producto, type CreateProductoDto } from '@/types/producto';

const schema = z.object({
  codigo: z.string().min(1, 'Ingrese el código interno'),
  codigo_barras: z.string().optional(),
  codigo_sunat: z.string().optional(),
  nombre: z.string().min(1, 'Ingrese el nombre / descripción'),
  id_categoria: z.string().optional(),
  id_subcategoria: z.string().optional(),
  id_marca: z.string().optional(),
  id_unidad_medida: z.string().min(1, 'Seleccione la unidad de medida'),
  tipo_existencia: z.string(),
  ubicacion: z.string().optional(),
  afecta_igv: z.boolean(),
  stock_minimo: z.number().min(0),
  stock_maximo: z.number().min(0),
  activo: z.boolean(),
  descripcion: z.string().optional(),
  codigos_proveedor: z.array(z.object({
    id_proveedor: z.string().min(1, 'Seleccione el proveedor'),
    codigo_alterno: z.string().min(1, 'Ingrese el código'),
  })).refine((rows) => new Set(rows.map((r) => r.id_proveedor)).size === rows.length, {
    message: 'No se puede repetir el mismo proveedor en los códigos alternos',
  }),
});
type FormValues = z.infer<typeof schema>;

const VACIO: FormValues = {
  codigo: '', codigo_barras: '', codigo_sunat: '', nombre: '', id_categoria: undefined,
  id_subcategoria: undefined, id_marca: undefined, id_unidad_medida: '', tipo_existencia: '01',
  ubicacion: '', afecta_igv: true, stock_minimo: 0, stock_maximo: 0, activo: true, descripcion: '',
  codigos_proveedor: [],
};

interface Props {
  open: boolean;
  producto: Producto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductoFormModal({ open, producto, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [precios, setPrecios] = useState<Record<number, number>>({});
  const { message } = App.useApp();

  const { data: categoriasData } = useQuery({ queryKey: ['categorias'], queryFn: () => categoriasApi.listar() });
  const { data: marcasData } = useQuery({ queryKey: ['marcas'], queryFn: () => marcasApi.listar() });
  const { data: unidadesData } = useQuery({ queryKey: ['unidades-medida'], queryFn: () => unidadesMedidaApi.listar() });
  const { data: proveedoresData } = useQuery({ queryKey: ['proveedores-all'], queryFn: () => proveedoresApi.listar({ limit: 500 }) });
  const { data: margenesData } = useQuery({ queryKey: ['config-margenes'], queryFn: () => configMargenesApi.listar() });

  const categorias = categoriasData?.data || [];
  const marcas = marcasData?.data || [];
  const unidades = unidadesData?.data || [];
  const proveedores = proveedoresData?.data || [];
  const margenes = [...(margenesData?.data || [])].sort((a, b) => a.numero - b.numero);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VACIO,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'codigos_proveedor' });
  const idCategoria = watch('id_categoria');
  const subcategoriasDisponibles = categorias.find((c) => c.id === idCategoria)?.subcategorias || [];

  useEffect(() => {
    if (!open) return;
    if (producto) {
      reset({
        codigo: producto.codigo,
        codigo_barras: producto.codigo_barras || '',
        codigo_sunat: producto.codigo_sunat || '',
        nombre: producto.nombre,
        id_categoria: producto.id_categoria || undefined,
        id_subcategoria: producto.id_subcategoria || undefined,
        id_marca: producto.id_marca || undefined,
        id_unidad_medida: producto.id_unidad_medida,
        tipo_existencia: producto.tipo_existencia || '01',
        ubicacion: producto.ubicacion || '',
        afecta_igv: producto.afecta_igv !== false,
        stock_minimo: Number(producto.stock_minimo || 0),
        stock_maximo: Number(producto.stock_maximo || 0),
        activo: producto.estado !== false,
        descripcion: producto.descripcion || '',
        codigos_proveedor: (producto.codigos_proveedor || []).map((c) => ({ id_proveedor: c.id_proveedor, codigo_alterno: c.codigo_alterno })),
      });
      const p: Record<number, number> = {};
      [1, 2, 3, 4, 5].forEach((n) => { p[n] = Number((producto as never as Record<string, unknown>)[`precio_venta_${n}`] ?? 0); });
      setPrecios(p);
    } else {
      reset(VACIO);
      setPrecios({});
    }
  }, [open, producto, reset]);

  const onSubmit = async (values: FormValues) => {
    const dto: CreateProductoDto = {
      codigo: values.codigo.trim().toUpperCase(),
      codigo_barras: values.codigo_barras || undefined,
      codigo_sunat: values.codigo_sunat || undefined,
      nombre: values.nombre.trim(),
      id_categoria: values.id_categoria || undefined,
      id_subcategoria: values.id_subcategoria || undefined,
      id_marca: values.id_marca || undefined,
      id_unidad_medida: values.id_unidad_medida,
      tipo_existencia: values.tipo_existencia,
      ubicacion: values.ubicacion || undefined,
      afecta_igv: values.afecta_igv,
      stock_minimo: values.stock_minimo,
      stock_maximo: values.stock_maximo,
      descripcion: values.descripcion || undefined,
      codigos_proveedor: values.codigos_proveedor,
    };
    margenes.forEach((m) => {
      (dto as unknown as Record<string, number>)[`precio_venta_${m.numero}`] = precios[m.numero] || 0;
    });
    if (producto) (dto as CreateProductoDto & { estado?: boolean }).estado = values.activo;

    setSaving(true);
    try {
      if (producto) await productosApi.actualizar(producto.id, dto);
      else await productosApi.crear(dto);
      message.success(producto ? 'Producto actualizado correctamente' : 'Producto creado correctamente');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={producto ? 'Editar Producto' : 'Nuevo Producto'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      confirmLoading={saving}
      okText="Guardar"
      cancelText="Cancelar"
      width={880}
      destroyOnHidden
    >
      <Form layout="vertical">
        <Divider titlePlacement="left" plain>Identificación</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Código interno" validateStatus={errors.codigo ? 'error' : ''} help={errors.codigo?.message}>
              <Controller name="codigo" control={control} render={({ field }) => <Input {...field} placeholder="Ej: REP-001" />} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Código de barras">
              <Controller name="codigo_barras" control={control} render={({ field }) => <Input {...field} placeholder="EAN / UPC" />} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Código SUNAT">
              <Controller name="codigo_sunat" control={control} render={({ field }) => <Input {...field} placeholder="Ej: 85176200" />} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Nombre / Descripción" validateStatus={errors.nombre ? 'error' : ''} help={errors.nombre?.message}>
              <Controller name="nombre" control={control} render={({ field }) => <Input {...field} placeholder="Ej: Filtro de aceite Toyota Corolla 2019" />} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left" plain>Códigos alternos por proveedor</Divider>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Cada proveedor puede tener su propio código para este producto (útil al recibir compras o buscar en catálogos del proveedor).
        </Typography.Paragraph>
        {fields.map((field, index) => (
          <Row gutter={8} key={field.id} style={{ marginBottom: 8 }} align="middle">
            <Col span={11}>
              <Controller
                name={`codigos_proveedor.${index}.id_proveedor`}
                control={control}
                render={({ field: f }) => (
                  <Select {...f} placeholder="Seleccione proveedor" style={{ width: '100%' }} options={proveedores.map((p) => ({ value: p.id, label: p.razon_social }))} />
                )}
              />
            </Col>
            <Col span={11}>
              <Controller
                name={`codigos_proveedor.${index}.codigo_alterno`}
                control={control}
                render={({ field: f }) => <Input {...f} placeholder="Código del proveedor" />}
              />
            </Col>
            <Col span={2}>
              <Button danger icon={<DeleteOutlined />} onClick={() => remove(index)} />
            </Col>
          </Row>
        ))}
        {errors.codigos_proveedor?.root?.message && <Alert type="error" title={errors.codigos_proveedor.root.message} style={{ marginBottom: 8 }} />}
        <Button icon={<PlusOutlined />} onClick={() => append({ id_proveedor: '', codigo_alterno: '' })} style={{ marginBottom: 16 }}>
          Agregar código de proveedor
        </Button>

        <Divider titlePlacement="left" plain>Clasificación</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Categoría">
              <Controller name="id_categoria" control={control} render={({ field }) => (
                <Select {...field} allowClear placeholder="Sin categoría" options={categorias.map((c) => ({ value: c.id, label: c.nombre }))} />
              )} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Subcategoría">
              <Controller name="id_subcategoria" control={control} render={({ field }) => (
                <Select {...field} allowClear disabled={!idCategoria} placeholder={idCategoria ? 'Sin subcategoría' : 'Seleccione categoría primero'} options={subcategoriasDisponibles.map((s) => ({ value: s.id, label: s.nombre }))} />
              )} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Marca">
              <Controller name="id_marca" control={control} render={({ field }) => (
                <Select {...field} allowClear placeholder="Sin marca" options={marcas.map((m) => ({ value: m.id, label: m.nombre }))} />
              )} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Unidad de medida" validateStatus={errors.id_unidad_medida ? 'error' : ''} help={errors.id_unidad_medida?.message}>
              <Controller name="id_unidad_medida" control={control} render={({ field }) => (
                <Select {...field} placeholder="Seleccione" options={unidades.map((u) => ({ value: u.id, label: `${u.simbolo} — ${u.descripcion}` }))} />
              )} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Tipo de existencia">
              <Controller name="tipo_existencia" control={control} render={({ field }) => <Select {...field} options={TIPOS_EXISTENCIA} />} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ubicación en almacén">
              <Controller name="ubicacion" control={control} render={({ field }) => <Input {...field} placeholder="Ej: Estante A-3" />} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left" plain>Configuración</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="Afecta IGV">
              <Controller name="afecta_igv" control={control} render={({ field }) => (
                <Select value={field.value} onChange={field.onChange} options={[{ value: true, label: 'Sí (18%)' }, { value: false, label: 'No (exonerado)' }]} />
              )} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Stock mín. de alerta">
              <Controller name="stock_minimo" control={control} render={({ field }) => <InputNumber {...field} min={0} style={{ width: '100%' }} />} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Stock máx. referencial">
              <Controller name="stock_maximo" control={control} render={({ field }) => <InputNumber {...field} min={0} style={{ width: '100%' }} />} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label=" ">
              <Controller name="activo" control={control} render={({ field }) => (
                <Space><Switch checked={field.value} onChange={field.onChange} /> Producto activo</Space>
              )} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left" plain>Precios</Divider>
        {producto && (
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <div style={{ background: '#fafafa', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}>
                <Typography.Text type="secondary">Costo promedio (ponderado): </Typography.Text>
                <Typography.Text strong>{formatMoneda(producto.costo_promedio)}</Typography.Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ background: '#fafafa', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}>
                <Typography.Text type="secondary">Último costo de compra (sin IGV): </Typography.Text>
                <Typography.Text strong>{formatMoneda(producto.precio_compra_sin_igv)}</Typography.Text>
              </div>
            </Col>
          </Row>
        )}
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          El costo se calcula automáticamente al registrar compras. Los precios de venta se sugieren según los márgenes configurados, pero puedes ajustarlos manualmente.
        </Typography.Paragraph>
        <Row gutter={16}>
          {margenes.map((m) => (
            <Col span={8} key={m.numero} style={{ marginBottom: 12 }}>
              <Typography.Text style={{ fontSize: 13 }}>{m.nombre} <Typography.Text type="secondary">({Number(m.margen)}%)</Typography.Text></Typography.Text>
              <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                <Button disabled>S/</Button>
                <InputNumber
                  value={precios[m.numero] ?? 0}
                  onChange={(v) => setPrecios((prev) => ({ ...prev, [m.numero]: v ?? 0 }))}
                  min={0} step={0.01} style={{ width: '100%' }}
                />
              </Space.Compact>
            </Col>
          ))}
        </Row>

        <Form.Item label="Notas adicionales">
          <Controller name="descripcion" control={control} render={({ field }) => <Input.TextArea {...field} rows={2} placeholder="Compatibilidad, observaciones, etc." />} />
        </Form.Item>

        <Alert type="info" showIcon title="El stock se actualiza automáticamente al registrar compras o realizar ajustes de inventario." />
      </Form>
    </Modal>
  );
}
