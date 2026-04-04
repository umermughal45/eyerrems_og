import { buildLocationTree, LocationRow } from '../services/location';

describe('Location service helpers', () => {
  it('builds a nested tree sorted by name and propagates property counts', () => {
    const rows: LocationRow[] = [
      {
        id: 'c1',
        name: 'City A',
        type: 'city',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'a1',
        name: 'Area Z',
        type: 'area',
        parentId: 'c1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'a2',
        name: 'Area B',
        type: 'area',
        parentId: 'c1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const tree = buildLocationTree(
      rows,
      new Map([
        ['c1', 3],
        ['a1', 1],
        ['a2', 2],
      ]),
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('City A');
    expect(tree[0].propertyCount).toBe(3);
    expect(tree[0].children).toHaveLength(2);
    // Children should be sorted by name
    expect(tree[0].children[0].name).toBe('Area B');
    expect(tree[0].children[0].propertyCount).toBe(2);
    expect(tree[0].children[1].name).toBe('Area Z');
    expect(tree[0].children[1].propertyCount).toBe(1);
  });

  it('returns empty tree when no rows provided', () => {
    const tree = buildLocationTree([] as LocationRow[], new Map());
    expect(tree).toHaveLength(0);
  });
});

