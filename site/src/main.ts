import './styles.css';
import { startApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('the showcase root element is missing');
startApp(root);
