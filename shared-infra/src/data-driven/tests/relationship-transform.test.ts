import { describe, it, expect } from 'vitest';
import {
  loadOneToOne,
  loadOneToMany,
  loadManyToMany,
  loadHasOneThrough,
  loadHasManyThrough,
  loadOneToOnePolymorphic,
  loadOneToManyPolymorphic,
  loadManyToManyPolymorphic,
} from '../transforms/relationship-transform';

describe('Relationship Transforms - All 8 Relationship Types', () => {
  const users = Object.freeze([
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ]);

  const profiles = Object.freeze([
    { id: 'p1', userId: '1', bio: 'Alice Bio' },
    { id: 'p2', userId: '2', bio: 'Bob Bio' },
  ]);

  const posts = Object.freeze([
    { id: 'post1', userId: '1', title: 'Post 1' },
    { id: 'post2', userId: '1', title: 'Post 2' },
    { id: 'post3', userId: '2', title: 'Post 3' },
  ]);

  const roles = Object.freeze([
    { id: 'r1', name: 'Admin' },
    { id: 'r2', name: 'User' },
  ]);

  const roleUserPivot = Object.freeze([
    { userId: '1', roleId: 'r1' },
    { userId: '1', roleId: 'r2' },
    { userId: '2', roleId: 'r2' },
  ]);

  it('1. loadOneToOne - joins 1-to-1 relations purely', () => {
    const loaded = loadOneToOne(users, profiles, {
      localKey: 'id',
      foreignKey: 'userId',
      as: 'profile',
    });

    expect((loaded[0] as any).profile).toEqual({ id: 'p1', userId: '1', bio: 'Alice Bio' });
    expect((loaded[1] as any).profile).toEqual({ id: 'p2', userId: '2', bio: 'Bob Bio' });
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded[0])).toBe(true);
  });

  it('2. loadOneToMany - joins 1-to-many relations purely', () => {
    const loaded = loadOneToMany(users, posts, {
      localKey: 'id',
      foreignKey: 'userId',
      as: 'posts',
    });

    expect((loaded[0] as any).posts.length).toBe(2);
    expect((loaded[1] as any).posts.length).toBe(1);
    expect(Object.isFrozen((loaded[0] as any).posts)).toBe(true);
  });

  it('3. loadManyToMany - joins many-to-many via pivot table purely', () => {
    const loaded = loadManyToMany(users, roles, {
      pivotStore: roleUserPivot,
      foreignPivotKey: 'userId',
      relatedPivotKey: 'roleId',
      parentLocalKey: 'id',
      relatedLocalKey: 'id',
      as: 'roles',
    });

    expect((loaded[0] as any).roles.length).toBe(2);
    expect((loaded[0] as any).roles.map((r: any) => r.name)).toEqual(['Admin', 'User']);
    expect((loaded[1] as any).roles.length).toBe(1);
    expect(Object.isFrozen((loaded[0] as any).roles)).toBe(true);
  });

  it('4. loadHasOneThrough - resolves HasOneThrough relations', () => {
    const mechanics = Object.freeze([{ id: 'm1', name: 'Mike' }]);
    const cars = Object.freeze([{ id: 'c1', mechanicId: 'm1', ownerId: '1' }]);
    const owners = Object.freeze([{ id: '1', name: 'Alice' }]);

    const loaded = loadHasOneThrough(mechanics, cars, owners, {
      throughForeignKey: 'mechanicId',
      throughLocalKey: 'ownerId',
      foreignKey: 'id',
      localKey: 'id',
      as: 'carOwner',
    });

    expect((loaded[0] as any).carOwner).toEqual({ id: '1', name: 'Alice' });
  });

  it('5. loadHasManyThrough - resolves HasManyThrough relations', () => {
    const countries = Object.freeze([{ id: 'c1', name: 'USA' }]);
    const usersInCountry = Object.freeze([{ id: 'u1', countryId: 'c1' }]);
    const postsOfUsers = Object.freeze([{ id: 'p1', userId: 'u1', title: 'USA Post' }]);

    const loaded = loadHasManyThrough(countries, usersInCountry, postsOfUsers, {
      throughForeignKey: 'countryId',
      throughLocalKey: 'id',
      foreignKey: 'userId',
      localKey: 'id',
      as: 'posts',
    });

    expect((loaded[0] as any).posts.length).toBe(1);
    expect((loaded[0] as any).posts[0].title).toBe('USA Post');
  });

  it('6. loadOneToOnePolymorphic - resolves polymorphic 1-to-1 relations', () => {
    const images = Object.freeze([
      { id: 'img1', imageableType: 'User', imageableId: '1', url: 'avatar.png' },
      { id: 'img2', imageableType: 'Post', imageableId: 'post1', url: 'post.png' },
    ]);

    const loaded = loadOneToOnePolymorphic(users, images, {
      typeField: 'imageableType',
      idField: 'imageableId',
      entityType: 'User',
      localKey: 'id',
      as: 'avatar',
    });

    expect((loaded[0] as any).avatar.url).toBe('avatar.png');
    expect((loaded[1] as any).avatar).toBeNull();
  });

  it('7. loadOneToManyPolymorphic - resolves polymorphic 1-to-many relations', () => {
    const comments = Object.freeze([
      { id: 'cm1', commentableType: 'Post', commentableId: 'post1', text: 'Great post' },
      { id: 'cm2', commentableType: 'Post', commentableId: 'post1', text: 'Awesome' },
      { id: 'cm3', commentableType: 'User', commentableId: '1', text: 'User profile comment' },
    ]);

    const loaded = loadOneToManyPolymorphic(posts, comments, {
      typeField: 'commentableType',
      idField: 'commentableId',
      entityType: 'Post',
      localKey: 'id',
      as: 'comments',
    });

    expect((loaded[0] as any).comments.length).toBe(2);
    expect((loaded[1] as any).comments.length).toBe(0);
  });

  it('8. loadManyToManyPolymorphic - resolves polymorphic many-to-many relations', () => {
    const tags = Object.freeze([
      { id: 't1', name: 'Tech' },
      { id: 't2', name: 'News' },
    ]);

    const taggables = Object.freeze([
      { tagId: 't1', taggableType: 'Post', taggableId: 'post1' },
      { tagId: 't2', taggableType: 'Post', taggableId: 'post1' },
    ]);

    const loaded = loadManyToManyPolymorphic(posts, tags, {
      pivotStore: taggables,
      pivotTypeField: 'taggableType',
      pivotIdField: 'taggableId',
      relatedPivotKey: 'tagId',
      entityType: 'Post',
      parentLocalKey: 'id',
      relatedLocalKey: 'id',
      as: 'tags',
    });

    expect((loaded[0] as any).tags.length).toBe(2);
    expect((loaded[0] as any).tags.map((t: any) => t.name)).toEqual(['Tech', 'News']);
  });
});
