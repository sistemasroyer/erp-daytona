import { App } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';

/** Reemplaza al confirmar() de components/modal.js del frontend viejo (que envolvía
 * un modal de Bootstrap manual). Uso: `const { confirmar } = useConfirmar(); const ok = await confirmar('¿Eliminar X?')`.
 * Usa el `modal` de contexto de <App> en vez de la función estática Modal.confirm()
 * para que respete el tema/locale configurados en <ConfigProvider>. */
export function useConfirmar() {
  const { modal } = App.useApp();

  const confirmar = (mensaje: string, titulo = 'Confirmar acción'): Promise<boolean> => {
    return new Promise((resolve) => {
      modal.confirm({
        title: titulo,
        icon: <ExclamationCircleFilled />,
        content: mensaje,
        okText: 'Confirmar',
        okType: 'danger',
        cancelText: 'Cancelar',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  return { confirmar };
}
