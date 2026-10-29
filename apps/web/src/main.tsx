import { createRoot } from 'react-dom/client'
// Ant Design 只管组件自己的样式；这份重置样式统一浏览器的默认样式（例如去掉 body 默认的 8px 外边距）
import 'antd/dist/reset.css'
import App from '@/App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
