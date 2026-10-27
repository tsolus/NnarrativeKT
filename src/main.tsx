import { render } from 'preact';
import { App } from './ui/App';
import { boot } from './state/app';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);
void boot();
