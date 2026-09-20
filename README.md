# PR Tracker

Plantilla generada con [Angular CLI](https://github.com/angular/angular-cli) 22.1.4 y gestionada con pnpm.

## Herramientas

- TypeScript 6.0.3
- Prettier 3.9.6
- ESLint 10.9.0 + angular-eslint 22.2.0
- Husky 9.1.7 y lint-staged 17.4.1
- Commitlint 21.2.2
- Jest 30 + jest-preset-angular + Testing Library
- Tailwind CSS 4.3.3 y PostCSS 8.5.26

## Development server

Para iniciar el servidor local de desarrollo, ejecuta:

```bash
pnpm exec ng serve
```

Cuando el servidor esté activo, abre `http://localhost:4200/`. La aplicación se recarga automáticamente al modificar los archivos fuente.

## Code scaffolding

Angular CLI incluye herramientas de scaffolding. Para generar un componente nuevo, ejecuta:

```bash
pnpm exec ng generate component component-name
```

Para consultar la lista completa de schematics disponibles, ejecuta:

```bash
pnpm exec ng generate --help
```

## Building

Para compilar el proyecto, ejecuta:

```bash
pnpm exec ng build
```

Los artefactos se guardan en `dist/`. Por defecto, la compilación de producción optimiza la aplicación para rendimiento y velocidad.

## Running unit tests

Los scripts de pruebas usan Jest:

```bash
pnpm test
pnpm test:watch
pnpm test:ci
```

Jest es el único runner de pruebas unitarias. No existe target `ng test`; ejecuta siempre `pnpm test`.

## Running end-to-end tests

Las pruebas end-to-end usan Playwright con Firefox y la API de GitHub completamente simulada. La primera vez instala el navegador:

```bash
pnpm exec playwright install firefox
```

Después ejecuta:

```bash
pnpm e2e
pnpm e2e:report
```

El runner levanta `ng serve` en el puerto 4300 automáticamente.

## Additional Resources

Para más información sobre Angular CLI y sus comandos, consulta la [guía y referencia de Angular CLI](https://angular.dev/tools/cli).
